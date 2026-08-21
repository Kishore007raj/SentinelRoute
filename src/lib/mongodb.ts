/**
 * mongodb.ts - MongoClient singleton for Next.js.
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
import { MONGODB_URI } from "@/lib/env";


const dbName = "sentinelroute";

// ─── Global cache (survives Next.js hot-reloads in dev) ───────────────────────

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  // Read and validate URI lazily — only when the first connection is needed,
  // not at module evaluation time. This lets the dev server start without
  // MONGODB_URI set, and fails fast at the first actual DB call instead.
  const uri = MONGODB_URI();
  if (!uri) {
    throw new Error(
      "[mongodb] MONGODB_URI environment variable is not set.\n" +
      "Add it to .env.local (dev) or your deployment environment (prod) and restart."
    );
  }
  const client = new MongoClient(uri);
  return client.connect();
}

/**
 * In development: attach to global so the promise survives module
 * re-evaluation on hot-reload (prevents multiple open connections).
 * In production: module is evaluated once per process - no global needed.
 *
 * The promise is created lazily on first getDb() call — never at module
 * load time — so the dev server starts cleanly without MONGODB_URI set.
 */
function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    global._mongoClientPromise ??= createClientPromise();
    return global._mongoClientPromise;
  }
  // Production: create once per module (module is evaluated once per process)
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClientPromise();
  }
  return global._mongoClientPromise;
}

/**
 * Returns the sentinelroute Db instance.
 * Reuses the cached MongoClient - never opens a second connection.
 * Triggers index creation on first call (idempotent, fire-and-forget).
 */
export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db(dbName);
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

// For any callers that need a MongoClient directly (e.g. for session management).
// Returns a Promise<MongoClient> — identical behaviour to the old default export
// but without calling getClientPromise() at module evaluation time.
export function getMongoClient(): Promise<MongoClient> {
  return getClientPromise();
}

/**
 * Helper to run multi-document operations inside a MongoDB transaction when supported by the cluster.
 *
 * When the cluster supports transactions (MongoDB Atlas M2+ / replica set):
 *   - All writes in the callback are committed atomically.
 *
 * When the cluster does NOT support transactions (Atlas M0/M2 shared, standalone):
 *   - Falls back to running the callback without a session (non-atomic).
 *   - Logs a warning so the behaviour is visible in server logs.
 *   - This preserves compatibility with Atlas free-tier deployments where
 *     transactions are not available, while still applying all writes correctly.
 */
export async function withTransaction<T>(
  fn: (db: Db, session?: import("mongodb").ClientSession) => Promise<T>
): Promise<T> {
  const client = await getMongoClient();
  const db = client.db(dbName);
  const session = client.startSession();

  try {
    let result: T | undefined;
    try {
      await session.withTransaction(async () => {
        result = await fn(db, session);
      });
      return result as T;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fallback for clusters that do not support multi-document transactions
      // (Atlas M0/M2 shared tier, standalone MongoDB instances).
      const isStandaloneError =
        msg.includes("Transaction numbers are only allowed") ||
        (err as { code?: number })?.code === 20;

      if (isStandaloneError) {
        console.warn(
          "[mongodb] withTransaction: cluster does not support transactions — " +
            "falling back to non-atomic execution. " +
            "Upgrade to Atlas M10+ or a dedicated replica set for full transaction support."
        );
        return await fn(db, undefined);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}
