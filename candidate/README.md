# Payment Recovery State Machine

The payment API currently has unsafe retry behavior. A duplicate request can create another gateway charge, and a gateway timeout can be marked as failed even if the gateway actually created or captured the charge.

Repair the payment path so it is safe under retries and ambiguous gateway responses.

## Local Services

- Postgres: payment intents, idempotency keys, settlement rows.
- WireMock: fake payment gateway.
- LocalStack SQS: reconciliation queue.

## Commands

```bash
npm ci
make dev
make seed
make test
make test-integration
make eval
make clean
```

## Suggested Work Areas

- `src/server.ts`
- `src/idempotency.ts`
- `src/paymentState.ts`
- `src/gatewayClient.ts`
- `src/reconciliationWorker.ts`
- `src/settlementReport.ts`

## Output

`make eval` writes `results/payment_recovery_report.json`.

Public tests check the core contract. Private tests add harder timeout, idempotency conflict, settlement, duplicate worker, and operator-report cases.
