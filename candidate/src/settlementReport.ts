import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createPool, PostgresPaymentStore, type PaymentStore } from "./db";
import type { PaymentIntent, RecoveryReport } from "./types";

function recommendedAction(intent: PaymentIntent): string {
  if (intent.state === "pending_reconciliation") return "check gateway truth before retrying or fulfilling";
  if (intent.state === "failed") return "review local failure state";
  if (intent.fulfillmentStatus === "release") return "fulfillment may proceed";
  return "hold fulfillment";
}

export async function buildRecoveryReport(store: PaymentStore): Promise<RecoveryReport> {
  const intents = await store.listIntents();
  return {
    generatedAt: new Date().toISOString(),
    payments: intents.map((intent) => ({
      paymentIntentId: intent.id,
      state: intent.state,
      gatewayChargeId: intent.gatewayChargeId,
      gatewayEvidence: {},
      localEvidence: {
        idempotencyKey: intent.idempotencyKey,
        gatewayStatus: intent.gatewayStatus,
        fulfillmentStatus: intent.fulfillmentStatus
      },
      recommendedAction: recommendedAction(intent)
    }))
  };
}

export async function writeRecoveryReport(store: PaymentStore, out = "results/payment_recovery_report.json"): Promise<RecoveryReport> {
  const report = await buildRecoveryReport(store);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  const pool = createPool();
  const store = new PostgresPaymentStore(pool);
  try {
    const report = await writeRecoveryReport(store);
    console.log(JSON.stringify({ payments: report.payments.length, out: "results/payment_recovery_report.json" }, null, 2));
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
