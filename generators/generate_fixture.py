#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=20260520)
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--out", default="candidate/fixtures/public/payment_requests.jsonl")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as handle:
        for index in range(args.count):
            row = {
                "tenantId": "tenant_alpha",
                "customerId": f"cust_{index:03d}",
                "orderId": f"ord_{index:03d}",
                "amountCents": rng.randrange(1000, 20000, 100),
                "currency": "USD",
                "idempotencyKey": f"generated-key-{args.seed}-{index}"
            }
            handle.write(json.dumps(row) + "\n")
    print(f"wrote {args.count} payment requests to {out}")


if __name__ == "__main__":
    main()
