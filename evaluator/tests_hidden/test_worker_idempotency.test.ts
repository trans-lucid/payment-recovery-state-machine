import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

describe("hidden worker idempotency", () => {
  it("does not create duplicate recovery effects across repeated worker runs", async () => {
    const server = await importFromTarget<typeof import("../../solution/src/server")>("src/server.ts");
    const db = await importFromTarget<typeof import("../../solution/src/db")>("src/db.ts");
    const gateway = await importFromTarget<typeof import("../../solution/src/gatewayClient")>("src/gatewayClient.ts");
    const queue = await importFromTarget<typeof import("../../solution/src/reconciliationWorker")>("src/reconciliationWorker.ts");

    const store = new db.InMemoryPaymentStore();
    const fakeGateway = new gateway.FakeGatewayClient("timeout_after_create", "captured");
    const recoveryQueue = new queue.InMemoryReconciliationQueue();
    const service = new server.PaymentService(store, fakeGateway, recoveryQueue);
    const created = await service.createPayment({
      tenantId: "tenant_hidden",
      customerId: "cust_worker",
      orderId: "order_worker",
      amountCents: 11000,
      currency: "USD",
      idempotencyKey: "hidden-worker-key"
    });

    await queue.processReconciliationOnce(store, fakeGateway, recoveryQueue);
    await queue.processReconciliationOnce(store, fakeGateway, recoveryQueue);
    const reconciled = await store.findIntentById(created.intent.id);
    expect(reconciled?.state).toBe("captured");
    expect(recoveryQueue.messages).toHaveLength(0);
  });
});
