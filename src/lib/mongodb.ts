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
 * Production behaviour (NODE_ENV === "production"):
 *   - Transactions are required. If the cluster does not support them (code 20 /
 *     standalone MongoDB), the function throws immediately rather than silently
 *     losing atomicity. This prevents split-state corruption in production.
 *
 * Development behaviour (all other NODE_ENV values):
 *   - Falls back to a non-transactional execution with a loud console warning when
 *     running against a standalone MongoDB instance that does not support
 *     transactions. This allows local development without a replica-set.
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
      const isStandaloneError =
        msg.includes("Transaction numbers are only allowed") ||
        (err as { code?: number })?.code === 20;

      if (isStandaloneError) {
        if (process.env.NODE_ENV === "production") {
          // Never silently lose atomicity in production.
          // A standalone MongoDB instance is not supported in production deployments.
          throw new Error(
            "[mongodb] withTransaction: transactions are unavailable on this cluster (MongoDB error code 20). " +
              "SentinelRoute requires a MongoDB replica set or Atlas cluster in production. " +
              `Original error: ${msg}`
          );
        }

        // Development-only fallback: warn loudly, then run without a session.
        console.warn(
          "[mongodb] withTransaction: WARNING — falling back to non-atomic execution. " +
            "This is only acceptable during local development against a standalone MongoDB instance. " +
            "Ensure your production deployment uses a replica set or MongoDB Atlas."
        );
        return await fn(db, undefined);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}
