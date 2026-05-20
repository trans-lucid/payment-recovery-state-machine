import { createHash } from "node:crypto";
import type { PaymentRequest } from "./types";

export function requestFingerprint(request: PaymentRequest): string {
  const stable = {
    tenantId: request.tenantId,
    customerId: request.customerId,
    orderId: request.orderId,
    amountCents: request.amountCents,
    currency: request.currency
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function validatePaymentRequest(request: PaymentRequest): string | undefined {
  if (!request.idempotencyKey) return "missing idempotency key";
  if (!request.tenantId) return "missing tenantId";
  if (!request.customerId) return "missing customerId";
  if (!request.orderId) return "missing orderId";
  if (!Number.isInteger(request.amountCents) || request.amountCents <= 0) return "invalid amountCents";
  if (!/^[A-Z]{3}$/.test(request.currency)) return "invalid currency";
  return undefined;
}
