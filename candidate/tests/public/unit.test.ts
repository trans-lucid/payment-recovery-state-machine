import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

const baseRequest = {
  tenantId: "tenant_alpha",
  customerId: "cust_public",
  orderId: "order_public",
  amountCents: 4200,
  currency: "USD",
  idempotencyKey: "public-duplicate-key"
};

async function modules() {
  const server = await importFromTarget<typeof import("../../src/server")>("src/server.ts");
  const db = await importFromTarget<typeof import("../../src/db")>("src/db.ts");
  const gateway = await importFromTarget<typeof import("../../src/gatewayClient")>("src/gatewayClient.ts");
  const queue = await importFromTarget<typeof import("../../src/reconciliationWorker")>("src/reconciliationWorker.ts");
  const report = await importFromTarget<typeof import("../../src/settlementReport")>("src/settlementReport.ts");
  return { server, db, gateway, queue, report };
}

describe("public payment recovery contract", () => {
  it("reuses the first result for a duplicate idempotency key", async () => {
    const { server, db, gateway, queue } = await modules();
    const store = new db.InMemoryPaymentStore();
    const fakeGateway = new gateway.FakeGatewayClient("success");
    const service = new server.PaymentService(store, fakeGateway, new queue.InMemoryReconciliationQueue());

    const first = await service.createPayment(baseRequest);
    const second = await service.createPayment(baseRequest);

    if (first.intent.id !== second.intent.id || fakeGateway.createCalls.length !== 1 || store.intents.size !== 1) {
      throw new Error("duplicate_gateway_charge");
    }
    expect(second.reused).toBe(true);
  });

  it("rejects malformed requests before calling the gateway", async () => {
    const { server, db, gateway, queue } = await modules();
    const store = new db.InMemoryPaymentStore();
    const fakeGateway = new gateway.FakeGatewayClient("success");
    const service = new server.PaymentService(store, fakeGateway, new queue.InMemoryReconciliationQueue());

    await expect(service.createPayment({ ...baseRequest, amountCents: 0 })).rejects.toThrow("INVALID_PAYMENT_REQUEST");
    expect(fakeGateway.createCalls).toHaveLength(0);
  });

  it("keeps timed-out payments pending reconciliation and queues recovery work", async () => {
    const { server, db, gateway, queue } = await modules();
    const store = new db.InMemoryPaymentStore();
    const fakeGateway = new gateway.FakeGatewayClient("timeout_after_create", "captured");
    const recoveryQueue = new queue.InMemoryReconciliationQueue();
    const service = new server.PaymentService(store, fakeGateway, recoveryQueue);

    const result = await service.createPayment({ ...baseRequest, idempotencyKey: "public-timeout-key" });

    if (result.intent.state !== "pending_reconciliation" || recoveryQueue.messages.length !== 1) {
      throw new Error("timeout_marked_failed");
    }
    expect(result.intent.state).toBe("pending_reconciliation");
  });

  it("writes operator reports with gateway evidence", async () => {
    const { server, db, gateway, queue, report } = await modules();
    const store = new db.InMemoryPaymentStore();
    const service = new server.PaymentService(store, new gateway.FakeGatewayClient("success"), new queue.InMemoryReconciliationQueue());
    await service.createPayment(baseRequest);

    const recoveryReport = await report.buildRecoveryReport(store);
    const payment = recoveryReport.payments[0];
    if (!payment?.gatewayEvidence || Object.keys(payment.gatewayEvidence).length === 0) {
      throw new Error("missing_gateway_evidence");
    }
    expect(payment.recommendedAction).toBeTruthy();
  });
});
