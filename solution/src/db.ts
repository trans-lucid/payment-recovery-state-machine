import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import type { FulfillmentStatus, PaymentIntent, PaymentRequest, PaymentState, SettlementRow } from "./types";

const { Pool } = pg;

export type CreateIntentInput = PaymentRequest & {
  requestHash: string;
  state?: PaymentState;
};

export interface IdempotencyRecord {
  idempotencyKey: string;
  requestHash: string;
  paymentIntentId: string;
}

export interface PaymentStore {
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  findIntentById(id: string): Promise<PaymentIntent | undefined>;
  findIntentByIdempotencyKey(idempotencyKey: string): Promise<PaymentIntent | undefined>;
  findIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | undefined>;
  saveIdempotencyRecord(idempotencyKey: string, requestHash: string, paymentIntentId: string): Promise<void>;
  updateIntent(id: string, patch: Partial<Pick<PaymentIntent, "state" | "gatewayChargeId" | "gatewayStatus" | "gatewayEvidence" | "fulfillmentStatus">>): Promise<PaymentIntent>;
  listIntents(): Promise<PaymentIntent[]>;
  insertSettlement(row: SettlementRow): Promise<void>;
  close?(): Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toIntent(row: Record<string, unknown>): PaymentIntent {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotency_key),
    requestHash: String(row.request_hash),
    tenantId: String(row.tenant_id),
    customerId: String(row.customer_id),
    orderId: String(row.order_id),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    state: String(row.state) as PaymentState,
    gatewayChargeId: row.gateway_charge_id ? String(row.gateway_charge_id) : undefined,
    gatewayStatus: row.gateway_status ? String(row.gateway_status) : undefined,
    gatewayEvidence: (row.gateway_evidence as Record<string, unknown>) ?? {},
    fulfillmentStatus: String(row.fulfillment_status) as FulfillmentStatus,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
  };
}

export class InMemoryPaymentStore implements PaymentStore {
  public intents = new Map<string, PaymentIntent>();
  public idempotency = new Map<string, IdempotencyRecord>();
  public settlements = new Map<string, SettlementRow>();

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const id = `pi_${randomUUID()}`;
    const timestamp = nowIso();
    const intent: PaymentIntent = {
      id,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      tenantId: input.tenantId,
      customerId: input.customerId,
      orderId: input.orderId,
      amountCents: input.amountCents,
      currency: input.currency,
      state: input.state ?? "created",
      gatewayEvidence: {},
      fulfillmentStatus: "hold",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.intents.set(id, intent);
    return intent;
  }

  async findIntentById(id: string): Promise<PaymentIntent | undefined> {
    return this.intents.get(id);
  }

  async findIntentByIdempotencyKey(idempotencyKey: string): Promise<PaymentIntent | undefined> {
    const record = this.idempotency.get(idempotencyKey);
    return record ? this.intents.get(record.paymentIntentId) : undefined;
  }

  async findIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | undefined> {
    return this.idempotency.get(idempotencyKey);
  }

  async saveIdempotencyRecord(idempotencyKey: string, requestHash: string, paymentIntentId: string): Promise<void> {
    this.idempotency.set(idempotencyKey, { idempotencyKey, requestHash, paymentIntentId });
  }

  async updateIntent(id: string, patch: Partial<Pick<PaymentIntent, "state" | "gatewayChargeId" | "gatewayStatus" | "gatewayEvidence" | "fulfillmentStatus">>): Promise<PaymentIntent> {
    const current = this.intents.get(id);
    if (!current) throw new Error(`payment intent not found: ${id}`);
    const updated = { ...current, ...patch, updatedAt: nowIso() };
    this.intents.set(id, updated);
    return updated;
  }

  async listIntents(): Promise<PaymentIntent[]> {
    return [...this.intents.values()];
  }

  async insertSettlement(row: SettlementRow): Promise<void> {
    this.settlements.set(row.id, row);
  }
}

export function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/payments"
  });
}

export async function migrate(pool = createPool()): Promise<void> {
  const sql = await readFile(new URL("../migrations/001_init.sql", import.meta.url), "utf8");
  await pool.query(sql);
}

export async function resetState(pool = createPool()): Promise<void> {
  await pool.query("truncate table recovery_reports, settlement_rows, idempotency_keys, payment_intents");
}

export class PostgresPaymentStore implements PaymentStore {
  constructor(private readonly pool = createPool()) {}

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    const id = `pi_${randomUUID()}`;
    const result = await this.pool.query(
      `insert into payment_intents (
        id, idempotency_key, request_hash, tenant_id, customer_id, order_id,
        amount_cents, currency, state
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *`,
      [
        id,
        input.idempotencyKey,
        input.requestHash,
        input.tenantId,
        input.customerId,
        input.orderId,
        input.amountCents,
        input.currency,
        input.state ?? "created"
      ]
    );
    return toIntent(result.rows[0]);
  }

  async findIntentById(id: string): Promise<PaymentIntent | undefined> {
    const result = await this.pool.query("select * from payment_intents where id = $1", [id]);
    return result.rows[0] ? toIntent(result.rows[0]) : undefined;
  }

  async findIntentByIdempotencyKey(idempotencyKey: string): Promise<PaymentIntent | undefined> {
    const result = await this.pool.query(
      `select pi.* from idempotency_keys ik
       join payment_intents pi on pi.id = ik.payment_intent_id
       where ik.idempotency_key = $1`,
      [idempotencyKey]
    );
    return result.rows[0] ? toIntent(result.rows[0]) : undefined;
  }

  async findIdempotencyRecord(idempotencyKey: string): Promise<IdempotencyRecord | undefined> {
    const result = await this.pool.query("select * from idempotency_keys where idempotency_key = $1", [idempotencyKey]);
    const row = result.rows[0];
    return row
      ? {
          idempotencyKey: row.idempotency_key,
          requestHash: row.request_hash,
          paymentIntentId: row.payment_intent_id
        }
      : undefined;
  }

  async saveIdempotencyRecord(idempotencyKey: string, requestHash: string, paymentIntentId: string): Promise<void> {
    await this.pool.query(
      `insert into idempotency_keys (idempotency_key, request_hash, payment_intent_id)
       values ($1, $2, $3)
       on conflict (idempotency_key) do nothing`,
      [idempotencyKey, requestHash, paymentIntentId]
    );
  }

  async updateIntent(id: string, patch: Partial<Pick<PaymentIntent, "state" | "gatewayChargeId" | "gatewayStatus" | "gatewayEvidence" | "fulfillmentStatus">>): Promise<PaymentIntent> {
    const current = await this.findIntentById(id);
    if (!current) throw new Error(`payment intent not found: ${id}`);
    const next = { ...current, ...patch };
    const result = await this.pool.query(
      `update payment_intents set
        state = $2,
        gateway_charge_id = $3,
        gateway_status = $4,
        gateway_evidence = $5,
        fulfillment_status = $6,
        updated_at = now()
       where id = $1
       returning *`,
      [id, next.state, next.gatewayChargeId ?? null, next.gatewayStatus ?? null, next.gatewayEvidence, next.fulfillmentStatus]
    );
    return toIntent(result.rows[0]);
  }

  async listIntents(): Promise<PaymentIntent[]> {
    const result = await this.pool.query("select * from payment_intents order by created_at, id");
    return result.rows.map(toIntent);
  }

  async insertSettlement(row: SettlementRow): Promise<void> {
    await this.pool.query(
      `insert into settlement_rows (id, payment_intent_id, captured_cents, settled_cents, currency)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do nothing`,
      [row.id, row.paymentIntentId, row.capturedCents, row.settledCents, row.currency]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
