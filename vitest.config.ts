import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "candidate/tests/public/**/*.test.ts",
      "solution/tests/**/*.test.ts",
      "evaluator/tests_hidden/**/*.test.ts"
    ],
    testTimeout: 30_000
  }
});
