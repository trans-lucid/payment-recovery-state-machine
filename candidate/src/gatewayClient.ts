import type { GatewayChargeResult, PaymentRequest } from "./types";

export class GatewayTimeoutError extends Error {
  constructor(message = "gateway timeout") {
    super(message);
    this.name = "GatewayTimeoutError";
  }
}

export interface PaymentGateway {
  createCharge(request: PaymentRequest): Promise<GatewayChargeResult>;
  getChargeByIdempotencyKey(idempotencyKey: string): Promise<GatewayChargeResult | undefined>;
}

export class FakeGatewayClient implements PaymentGateway {
  public createCalls: PaymentRequest[] = [];
  private readonly statuses = new Map<string, GatewayChargeResult>();

  constructor(
    private readonly behavior: "success" | "timeout_after_create" | "failed" = "success",
    private readonly statusAfterTimeout: GatewayChargeResult["status"] = "captured"
  ) {}

  async createCharge(request: PaymentRequest): Promise<GatewayChargeResult> {
    this.createCalls.push(request);
    const result: GatewayChargeResult = {
      gatewayChargeId: `gw_${request.idempotencyKey}`,
      status: this.behavior === "failed" ? "failed" : this.statusAfterTimeout,
      amountCents: request.amountCents,
      currency: request.currency,
      evidence: {
        source: "fake-gateway",
        idempotencyKey: request.idempotencyKey,
        callCount: this.createCalls.length
      }
    };
    this.statuses.set(request.idempotencyKey, result);
    if (this.behavior === "timeout_after_create") {
      throw new GatewayTimeoutError("gateway timed out after creating charge");
    }
    return result;
  }

  async getChargeByIdempotencyKey(idempotencyKey: string): Promise<GatewayChargeResult | undefined> {
    return this.statuses.get(idempotencyKey);
  }
}

export class HttpGatewayClient implements PaymentGateway {
  constructor(
    private readonly baseUrl = process.env.GATEWAY_BASE_URL ?? "http://localhost:8091",
    private readonly timeoutMs = Number(process.env.GATEWAY_TIMEOUT_MS ?? 300)
  ) {}

  async createCharge(request: PaymentRequest): Promise<GatewayChargeResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/gateway/charges`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": request.idempotencyKey
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`gateway returned ${response.status}`);
      }
      return (await response.json()) as GatewayChargeResult;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new GatewayTimeoutError("gateway create charge timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getChargeByIdempotencyKey(idempotencyKey: string): Promise<GatewayChargeResult | undefined> {
    const response = await fetch(`${this.baseUrl}/gateway/charges/by-key/${encodeURIComponent(idempotencyKey)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`gateway lookup returned ${response.status}`);
    return (await response.json()) as GatewayChargeResult;
  }
}

export function isGatewayTimeout(error: unknown): boolean {
  return error instanceof GatewayTimeoutError;
}
