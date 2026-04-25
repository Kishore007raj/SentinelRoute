/**
 * mongodb.ts — MongoClient singleton for Next.js.
 *
 * Fails fast at module load time if MONGODB_URI is missing.
 * Uses a global promise cache so the connection is reused across
 * hot-reloads in dev and across invocations within the same process.
 *
 * DB name: sentinelroute
 */

import { MongoClient, type Db } from "mongodb";

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
 */
export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
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
