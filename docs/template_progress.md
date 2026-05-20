# Template Library Progress

| # | Template | Coverage | Local services | Status | Validation |
| -: | --- | --- | --- | --- | --- |
| 1 | async-webhook-ledger | backend reliability, webhooks, idempotency | Postgres, LocalStack, WireMock, MailHog | golden | previously accepted |
| 2 | rag-retrieval-quality-lab | AI backend, retrieval, citations | Qdrant, Postgres, MinIO, fake embeddings | golden-template-candidate | previously accepted |
| 3 | gpu-fault-correlation-drain-scheduler | ML infra, telemetry, scheduling | Prometheus/fake telemetry/LocalStack-style simulator | golden | previously accepted |
| 4 | streaming-chat-budget-tools | full-stack AI, streaming, tools, budget, UI state | fake streaming model and tool simulator | golden | previously accepted |
| 5 | agent-trace-evaluator | AI evals, agent trajectory scoring | fake trace API, Jaeger | golden | previously accepted |
| 6 | payment-recovery-state-machine | backend reliability, fintech, payment recovery | Postgres, WireMock, LocalStack SQS | golden-template-candidate | local validation passed; remote CI and fresh-clone proof pending |
