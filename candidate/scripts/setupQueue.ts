import { ensureQueue } from "../src/reconciliationWorker";

ensureQueue()
  .then((queueUrl) => console.log(`queue ready: ${queueUrl}`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
