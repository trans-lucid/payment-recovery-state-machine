# Source Dossier: Payment Recovery State Machine

## Sources Studied

- Stripe Payment Intents: state-machine vocabulary for payments moving through creation, authorization, capture, and settlement-like milestones.
- Stripe idempotency concepts: first result for an idempotency key should be returned on safe retries.
- stripe-mock: local payment-provider mock shape, not behavior copied into this template.
- Temporal workflow samples: durable retry and recovery design ideas.
- WireMock: local HTTP dependency simulation for delays, errors, and gateway responses.
- LocalStack SQS: local queue emulator for retry and reconciliation work.

## Allowed Reuse

- Architecture ideas.
- Generic payment-state terminology.
- Generic idempotency-key behavior.
- Local emulator patterns.
- Recovery and retry concepts.

## Forbidden

- Copying source code from public repos.
- Copying complete exercises or challenge text.
- Copying real customer payment data.
- Requiring live Stripe, AWS, bank, or processor credentials.
- Publishing hidden evaluator material in generated candidate main.
