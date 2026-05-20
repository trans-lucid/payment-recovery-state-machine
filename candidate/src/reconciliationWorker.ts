import { CreateQueueCommand, DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createPool, PostgresPaymentStore, type PaymentStore } from "./db";
import type { PaymentGateway } from "./gatewayClient";
import { HttpGatewayClient } from "./gatewayClient";
import { stateFromGateway } from "./paymentState";

export interface ReconciliationMessage {
  paymentIntentId: string;
  idempotencyKey: string;
  reason: string;
}

export interface ReconciliationQueue {
  enqueue(message: ReconciliationMessage): Promise<void>;
  receive(maxMessages?: number): Promise<Array<{ body: ReconciliationMessage; receiptHandle?: string }>>;
  delete(receiptHandle: string): Promise<void>;
}

export class InMemoryReconciliationQueue implements ReconciliationQueue {
  public messages: Array<{ body: ReconciliationMessage; receiptHandle: string }> = [];

  async enqueue(message: ReconciliationMessage): Promise<void> {
    this.messages.push({ body: message, receiptHandle: `receipt-${this.messages.length}` });
  }

  async receive(maxMessages = 10): Promise<Array<{ body: ReconciliationMessage; receiptHandle?: string }>> {
    return this.messages.slice(0, maxMessages);
  }

  async delete(receiptHandle: string): Promise<void> {
    this.messages = this.messages.filter((message) => message.receiptHandle !== receiptHandle);
  }
}

export function createSqsClient() {
  return new SQSClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    endpoint: process.env.SQS_ENDPOINT ?? "http://localhost:4567",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test"
    }
  });
}

export async function ensureQueue(client = createSqsClient()): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await client.send(new CreateQueueCommand({ QueueName: process.env.RECONCILIATION_QUEUE_NAME ?? "payment-reconciliation" }));
      if (!response.QueueUrl) throw new Error("LocalStack did not return queue URL");
      return response.QueueUrl;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export class SqsReconciliationQueue implements ReconciliationQueue {
  constructor(private readonly client = createSqsClient(), private queueUrl?: string) {}

  private async url(): Promise<string> {
    this.queueUrl ??= await ensureQueue(this.client);
    return this.queueUrl;
  }

  async enqueue(message: ReconciliationMessage): Promise<void> {
    await this.client.send(new SendMessageCommand({ QueueUrl: await this.url(), MessageBody: JSON.stringify(message) }));
  }

  async receive(maxMessages = 10): Promise<Array<{ body: ReconciliationMessage; receiptHandle?: string }>> {
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: await this.url(),
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 1
      })
    );
    return (response.Messages ?? [])
      .filter((message) => message.Body)
      .map((message) => ({
        body: JSON.parse(message.Body ?? "{}") as ReconciliationMessage,
        receiptHandle: message.ReceiptHandle
      }));
  }

  async delete(receiptHandle: string): Promise<void> {
    await this.client.send(new DeleteMessageCommand({ QueueUrl: await this.url(), ReceiptHandle: receiptHandle }));
  }
}

export async function processReconciliationOnce(
  store: PaymentStore,
  gateway: PaymentGateway,
  queue: ReconciliationQueue,
  maxMessages = 10
): Promise<number> {
  const messages = await queue.receive(maxMessages);
  let processed = 0;
  for (const message of messages) {
    const intent = await store.findIntentById(message.body.paymentIntentId);
    if (intent) {
      await store.updateIntent(intent.id, {
        state: "failed",
        gatewayEvidence: {
          ...intent.gatewayEvidence,
          reconciliation: "starter did not query gateway truth"
        },
        fulfillmentStatus: "hold"
      });
      processed += 1;
    }
    if (message.receiptHandle) {
      await queue.delete(message.receiptHandle);
    }
  }
  return processed;
}

async function main() {
  const pool = createPool();
  const store = new PostgresPaymentStore(pool);
  try {
    const processed = await processReconciliationOnce(store, new HttpGatewayClient(), new SqsReconciliationQueue());
    console.log(`processed reconciliation messages=${processed}`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
