import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

describe("hidden idempotency conflict handling", () => {
  it("rejects same idempotency key with different amount without a second gateway charge", async () => {
    const server = await importFromTarget<typeof import("../../solution/src/server")>("src/server.ts");
    const db = await importFromTarget<typeof import("../../solution/src/db")>("src/db.ts");
    const gateway = await importFromTarget<typeof import("../../solution/src/gatewayClient")>("src/gatewayClient.ts");
    const queue = await importFromTarget<typeof import("../../solution/src/reconciliationWorker")>("src/reconciliationWorker.ts");

    const store = new db.InMemoryPaymentStore();
    const fakeGateway = new gateway.FakeGatewayClient("success");
    const service = new server.PaymentService(store, fakeGateway, new queue.InMemoryReconciliationQueue());
    const request = {
      tenantId: "tenant_hidden",
      customerId: "cust_hidden",
      orderId: "order_hidden",
      amountCents: 5000,
      currency: "USD",
      idempotencyKey: "hidden-conflict-key"
    };

    await service.createPayment(request);
    await expect(service.createPayment({ ...request, amountCents: 5100 })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    if (fakeGateway.createCalls.length !== 1) {
      throw new Error("duplicate_gateway_charge");
    }
    expect(fakeGateway.createCalls).toHaveLength(1);
  });
});
