import { describe, expect, it } from "vitest";
import { InMemoryPaymentStore } from "../src/db";
import { FakeGatewayClient } from "../src/gatewayClient";
import { InMemoryReconciliationQueue, processReconciliationOnce } from "../src/reconciliationWorker";
import { PaymentService } from "../src/server";

describe("reference solution smoke test", () => {
  it("reconciles a timeout against gateway truth", async () => {
    const store = new InMemoryPaymentStore();
    const gateway = new FakeGatewayClient("timeout_after_create", "captured");
    const queue = new InMemoryReconciliationQueue();
    const service = new PaymentService(store, gateway, queue);

    const result = await service.createPayment({
      tenantId: "tenant_alpha",
      customerId: "cust_reference",
      orderId: "order_reference",
      amountCents: 8800,
      currency: "USD",
      idempotencyKey: "reference-timeout-key"
    });

    expect(result.intent.state).toBe("pending_reconciliation");
    await processReconciliationOnce(store, gateway, queue);
    const reconciled = await store.findIntentById(result.intent.id);
    expect(reconciled?.state).toBe("captured");
  });
});
