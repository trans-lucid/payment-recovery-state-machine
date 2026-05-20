import type { FulfillmentStatus, GatewayChargeResult, PaymentState, SettlementRow } from "./types";

export function stateFromGateway(result: GatewayChargeResult): PaymentState {
  if (result.status === "settled") return "settled";
  if (result.status === "captured") return "captured";
  if (result.status === "authorized") return "authorized";
  if (result.status === "failed") return "failed";
  return "pending_reconciliation";
}

export function fulfillmentForState(state: PaymentState, settlement?: SettlementRow): FulfillmentStatus {
  if (state === "failed") return "hold";
  if (state === "captured" || state === "settled") return "release";
  if (settlement && settlement.settledCents < settlement.capturedCents) return "manual_review";
  return "hold";
}
