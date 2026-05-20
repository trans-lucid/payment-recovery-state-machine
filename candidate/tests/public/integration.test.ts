import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

describe("Docker-backed payment recovery path", () => {
  it("routes timeout recovery through Postgres, WireMock, and LocalStack SQS", async () => {
    const server = await importFromTarget<typeof import("../../src/server")>("src/server.ts");
    const db = await importFromTarget<typeof import("../../src/db")>("src/db.ts");
    const gateway = await importFromTarget<typeof import("../../src/gatewayClient")>("src/gatewayClient.ts");
    const queue = await importFromTarget<typeof import("../../src/reconciliationWorker")>("src/reconciliationWorker.ts");

    const pool = db.createPool();
    const store = new db.PostgresPaymentStore(pool);
    const recoveryQueue = new queue.SqsReconciliationQueue();
    const service = new server.PaymentService(store, new gateway.HttpGatewayClient(), recoveryQueue);

    try {
      const result = await service.createPayment({
        tenantId: "tenant_alpha",
        customerId: "cust_timeout",
        orderId: "ord_timeout_public",
        amountCents: 9900,
        currency: "USD",
        idempotencyKey: "public-timeout-key"
      });

      if (result.intent.state !== "pending_reconciliation") {
        throw new Error("timeout_marked_failed");
      }

      const messages = await recoveryQueue.receive(1);
      if (messages.length !== 1 || messages[0]?.body.paymentIntentId !== result.intent.id) {
        throw new Error("timeout_marked_failed");
      }

      const persisted = await store.findIntentById(result.intent.id);
      expect(persisted?.state).toBe("pending_reconciliation");
    } finally {
      await pool.end();
    }
  });
});
