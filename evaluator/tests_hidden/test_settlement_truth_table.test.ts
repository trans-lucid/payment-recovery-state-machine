import { describe, expect, it } from "vitest";
import { importFromTarget } from "./loadTarget";

describe("hidden settlement truth table", () => {
  it("does not release fulfillment for partial settlement", async () => {
    const paymentState = await importFromTarget<typeof import("../../solution/src/paymentState")>("src/paymentState.ts");
    const status = paymentState.fulfillmentForState("captured", {
      id: "settlement_hidden",
      paymentIntentId: "pi_hidden",
      capturedCents: 9000,
      settledCents: 4500,
      currency: "USD"
    });

    if (status === "release") {
      throw new Error("settlement_state_wrong");
    }
    expect(status).toBe("manual_review");
  });
});
