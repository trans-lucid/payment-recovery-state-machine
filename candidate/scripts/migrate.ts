import { createPool, migrate } from "../src/db";

async function main() {
  const pool = createPool();
  let lastError: unknown;
  try {
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      try {
        await migrate(pool);
        console.log("database schema ready");
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
