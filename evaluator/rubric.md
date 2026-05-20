# Rubric

## Strong

- Stores idempotency keys before or atomically with external charge creation.
- Returns the original payment result for identical idempotent retries.
- Rejects idempotency-key reuse with conflicting payment parameters.
- Represents ambiguous timeout as pending reconciliation, not failed.
- Uses the reconciliation queue and gateway truth lookup before finalizing ambiguous payments.
- Keeps fulfillment blocked until settlement/capture truth is sufficient.
- Produces an operator report with local state, gateway evidence, and a recommended action.

## Partial

- Handles duplicate local rows but still risks duplicate gateway calls.
- Handles timeout as pending but does not reconcile gateway truth.
- Has a state machine but releases fulfillment too early.
- Report is useful locally but lacks gateway evidence.

## Weak

- Calls the gateway on every retry.
- Marks timeouts as failed without follow-up.
- Bypasses Postgres, WireMock, or SQS in integration behavior.
- Hardcodes public fixture IDs.
