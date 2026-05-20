export type PaymentState =
  | "created"
  | "processing"
  | "pending_reconciliation"
  | "authorized"
  | "captured"
  | "settled"
  | "failed";

export type FulfillmentStatus = "hold" | "release" | "manual_review";

export interface PaymentRequest {
  tenantId: string;
  customerId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}

export interface PaymentIntent {
  id: string;
  idempotencyKey: string;
  requestHash: string;
  tenantId: string;
  customerId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  state: PaymentState;
  gatewayChargeId?: string;
  gatewayStatus?: string;
  gatewayEvidence: Record<string, unknown>;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayChargeResult {
  gatewayChargeId: string;
  status: "authorized" | "captured" | "settled" | "failed" | "pending";
  amountCents: number;
  currency: string;
  evidence: Record<string, unknown>;
}

export interface SettlementRow {
  id: string;
  paymentIntentId: string;
  capturedCents: number;
  settledCents: number;
  currency: string;
}

export interface RecoveryReport {
  generatedAt: string;
  payments: Array<{
    paymentIntentId: string;
    state: PaymentState;
    gatewayChargeId?: string;
    gatewayEvidence: Record<string, unknown>;
    localEvidence: Record<string, unknown>;
    recommendedAction: string;
  }>;
}

export interface CreatePaymentResult {
  intent: PaymentIntent;
  reused: boolean;
}
