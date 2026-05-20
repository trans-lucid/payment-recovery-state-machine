#!/usr/bin/env python3
from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "generated"


def copytree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("node_modules", ".DS_Store"))


def render_main() -> Path:
    main = GENERATED / "main"
    copytree(ROOT / "candidate", main)
    return main


def render_solution() -> Path:
    solution = GENERATED / "solution"
    copytree(ROOT / "candidate", solution)
    shutil.copytree(ROOT / "solution", solution / "solution", ignore=shutil.ignore_patterns("node_modules", ".DS_Store"))
    shutil.copytree(ROOT / "evaluator", solution / "evaluator", ignore=shutil.ignore_patterns("node_modules", ".DS_Store"))
    shutil.copy2(ROOT / "solution" / "SOLUTION.md.j2", solution / "SOLUTION.md")
    shutil.copy2(ROOT / "evaluator" / "rubric.md", solution / "rubric.md")
    shutil.copy2(ROOT / "tools" / "generated_solution_vitest.config.ts", solution / "vitest.config.ts")
    shutil.copy2(ROOT / "tsconfig.json", solution / "tsconfig.json")
    return solution


def main() -> None:
    if GENERATED.exists():
        shutil.rmtree(GENERATED)
    GENERATED.mkdir(parents=True)
    main_dir = render_main()
    solution_dir = render_solution()
    print(f"rendered candidate main: {main_dir}")
    print(f"rendered solution: {solution_dir}")


if __name__ == "__main__":
    main()
