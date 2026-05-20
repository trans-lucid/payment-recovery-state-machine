import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

describe("hidden operator report evidence", () => {
  it("includes gateway evidence, local state, and an action", async () => {
    const server = await importFromTarget<typeof import("../../solution/src/server")>("src/server.ts");
    const db = await importFromTarget<typeof import("../../solution/src/db")>("src/db.ts");
    const gateway = await importFromTarget<typeof import("../../solution/src/gatewayClient")>("src/gatewayClient.ts");
    const queue = await importFromTarget<typeof import("../../solution/src/reconciliationWorker")>("src/reconciliationWorker.ts");
    const report = await importFromTarget<typeof import("../../solution/src/settlementReport")>("src/settlementReport.ts");

    const store = new db.InMemoryPaymentStore();
    const service = new server.PaymentService(store, new gateway.FakeGatewayClient("success"), new queue.InMemoryReconciliationQueue());
    await service.createPayment({
      tenantId: "tenant_hidden",
      customerId: "cust_report",
      orderId: "order_report",
      amountCents: 6400,
      currency: "USD",
      idempotencyKey: "hidden-report-key"
    });
    const recoveryReport = await report.buildRecoveryReport(store);
    const payment = recoveryReport.payments[0];
    if (!payment?.gatewayEvidence || Object.keys(payment.gatewayEvidence).length === 0 || !payment.recommendedAction) {
      throw new Error("missing_gateway_evidence");
    }
    expect(payment.localEvidence).toBeTruthy();
  });
});
