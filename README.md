# Payment Recovery State Machine

Internal Translucid challenge template for outbound payment recovery work. This is not a generated candidate repository.

The generated challenge simulates a B2B checkout/payment API where a gateway timeout can leave local state ambiguous. Candidates repair idempotent payment creation, state transitions, timeout reconciliation, settlement gating, and operator reporting.

## Local Simulator

Candidate-facing generated repos use:

- Postgres for payment intents, idempotency keys, settlement rows, and report state.
- WireMock for a fake payment gateway that can succeed, timeout after creating a charge, or return errors.
- LocalStack SQS for reconciliation work after ambiguous gateway calls.

No external Stripe, AWS, bank, or customer credentials are required.

## Template Validation

```bash
npm ci
npm run validate
```

Validation checks:

- reference solution passes public and hidden tests
- unsolved starter fails for expected payment markers
- rendered candidate main contains no private evaluator material
- Docker-backed integration exercises Postgres, WireMock, and LocalStack SQS
- rendered solution passes public and hidden tests

Expected starter markers:

- `duplicate_gateway_charge`
- `timeout_marked_failed`
- `missing_gateway_evidence`
- `settlement_state_wrong`
