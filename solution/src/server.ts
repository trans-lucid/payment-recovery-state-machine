import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { requestFingerprint, validatePaymentRequest } from "./idempotency";
import { stateFromGateway } from "./paymentState";
import { createPool, InMemoryPaymentStore, PostgresPaymentStore, type PaymentStore } from "./db";
import { FakeGatewayClient, HttpGatewayClient, isGatewayTimeout, type PaymentGateway } from "./gatewayClient";
import { InMemoryReconciliationQueue, SqsReconciliationQueue, type ReconciliationQueue } from "./reconciliationWorker";
import type { CreatePaymentResult, PaymentRequest } from "./types";

export class PaymentService {
  constructor(
    private readonly store: PaymentStore = new InMemoryPaymentStore(),
    private readonly gateway: PaymentGateway = new FakeGatewayClient(),
    private readonly queue: ReconciliationQueue = new InMemoryReconciliationQueue()
  ) {}

  async createPayment(request: PaymentRequest): Promise<CreatePaymentResult> {
    const validationError = validatePaymentRequest(request);
    if (validationError) {
      throw new Error(`INVALID_PAYMENT_REQUEST:${validationError}`);
    }

    const requestHash = requestFingerprint(request);

    const existingRecord = await this.store.findIdempotencyRecord(request.idempotencyKey);
    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new Error("IDEMPOTENCY_CONFLICT: same key used for different payment parameters");
      }
      const existingIntent = await this.store.findIntentById(existingRecord.paymentIntentId);
      if (!existingIntent) {
        throw new Error("IDEMPOTENCY_CORRUPTION: recorded intent is missing");
      }
      return { intent: existingIntent, reused: true };
    }

    const intent = await this.store.createIntent({ ...request, requestHash, state: "processing" });
    await this.store.saveIdempotencyRecord(request.idempotencyKey, requestHash, intent.id);

    try {
      const gatewayResult = await this.gateway.createCharge(request);
      const updated = await this.store.updateIntent(intent.id, {
        state: stateFromGateway(gatewayResult),
        gatewayChargeId: gatewayResult.gatewayChargeId,
        gatewayStatus: gatewayResult.status,
        gatewayEvidence: gatewayResult.evidence,
        fulfillmentStatus: gatewayResult.status === "settled" ? "release" : "hold"
      });
      return { intent: updated, reused: false };
    } catch (error) {
      if (isGatewayTimeout(error)) {
        const pending = await this.store.updateIntent(intent.id, {
          state: "pending_reconciliation",
          gatewayStatus: "timeout",
          gatewayEvidence: { timeout: true, recovery: "queued for gateway truth lookup" },
          fulfillmentStatus: "hold"
        });
        await this.queue.enqueue({
          paymentIntentId: intent.id,
          idempotencyKey: request.idempotencyKey,
          reason: "gateway_timeout_after_create"
        });
        return { intent: pending, reused: false };
      }
      throw error;
    }
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

export function createPaymentServer(service: PaymentService) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "POST" && request.url === "/payments") {
        const result = await service.createPayment((await readJson(request)) as PaymentRequest);
        writeJson(response, result.reused ? 200 : 201, result);
        return;
      }
      writeJson(response, 404, { error: "not_found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(response, message.startsWith("INVALID_PAYMENT_REQUEST") ? 400 : 500, { error: message });
    }
  });
}

export function createDefaultPaymentService(): { service: PaymentService; close: () => Promise<void> } {
  const pool = createPool();
  const service = new PaymentService(new PostgresPaymentStore(pool), new HttpGatewayClient(), new SqsReconciliationQueue());
  return { service, close: () => pool.end() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { service, close } = createDefaultPaymentService();
  const server = createPaymentServer(service);
  const port = Number(process.env.PORT ?? 3010);
  server.listen(port, () => console.log(`payment recovery API listening on ${port}`));
  process.on("SIGTERM", () => {
    server.close(() => close().finally(() => process.exit(0)));
  });
}
