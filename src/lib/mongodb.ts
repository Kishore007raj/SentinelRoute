/**
 * mongodb.ts — MongoClient singleton for Next.js.
 *
 * Fails fast at module load time if MONGODB_URI is missing.
 * Uses a global promise cache so the connection is reused across
 * hot-reloads in dev and across invocations within the same process.
 *
 * DB name: sentinelroute
 * Indexes: ensured on first getDb() call via mongodb-indexes.ts
 */

import { MongoClient, type Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb-indexes";
import { ensureWorkforceIndexes } from "@/lib/workforce-indexes";

// ─── Env validation — fail fast ───────────────────────────────────────────────

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "[mongodb] MONGODB_URI environment variable is not set.\n" +
    "Add it to .env.local (dev) or your deployment environment (prod) and restart."
  );
}

const dbName = "sentinelroute";

// ─── Global cache (survives Next.js hot-reloads in dev) ───────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(uri!);
  return client.connect();
}

/**
 * In development: attach to global so the promise survives module
 * re-evaluation on hot-reload (prevents multiple open connections).
 * In production: module is evaluated once per process — no global needed.
 */
const clientPromise: Promise<MongoClient> =
  process.env.NODE_ENV === "development"
    ? (global._mongoClientPromise ??= createClientPromise())
    : createClientPromise();

/**
 * Returns the sentinelroute Db instance.
 * Reuses the cached MongoClient — never opens a second connection.
 * Triggers index creation on first call (idempotent, fire-and-forget).
 */
export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);
  // Fire-and-forget: both index sets guard themselves with boolean flags —
  // each runs once per process, never blocks the caller, never throws.
  ensureIndexes(db).catch(() => {/* already logged inside ensureIndexes */});
  ensureWorkforceIndexes(db).catch(() => {/* already logged inside ensureWorkforceIndexes */});
  return db;
}

// Legacy aliases kept for any existing callers
export async function connectDb(): Promise<Db> {
  return getDb();
}

export async function getShipmentsCollection() {
  const db = await getDb();
  return db.collection("shipments");
}

export default clientPromise;
