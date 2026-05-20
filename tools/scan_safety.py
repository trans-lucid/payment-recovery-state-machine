#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path


FORBIDDEN_PARTS = {
    "solution",
    "evaluator",
    "tests_hidden",
    "fixtures_hidden",
    "source-dossiers",
    "template.yaml",
    "SOLUTION.md",
    "SOLUTION.md.j2",
    "rubric.md",
    "expected",
}

SECRET_PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"OPENAI_API_KEY", re.IGNORECASE),
    re.compile(r"PINECONE_API_KEY", re.IGNORECASE),
    re.compile(r"SUPABASE_SERVICE_ROLE", re.IGNORECASE),
    re.compile(r"GITHUB_TOKEN", re.IGNORECASE),
    re.compile(r"BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY"),
    re.compile(r"customer[_-]?source", re.IGNORECASE),
]


def fail(message: str) -> None:
    print(f"safety scan failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "generated/main").resolve()
    if not root.exists():
        fail(f"{root} does not exist")

    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if any(part in FORBIDDEN_PARTS for part in relative.parts):
            fail(f"forbidden candidate-main path leaked: {relative}")
        if path.is_file():
            if path.name == ".env":
                fail(f".env file leaked: {relative}")
            text = path.read_text(errors="ignore")
            for pattern in SECRET_PATTERNS:
                if pattern.search(text):
                    fail(f"secret/customer marker found in {relative}")
    print(f"safety scan passed for {root}")


if __name__ == "__main__":
    main()
