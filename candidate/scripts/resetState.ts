import { createPool, resetState } from "../src/db";

async function main() {
  const pool = createPool();
  try {
    await resetState(pool);
    console.log("payment state reset");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
