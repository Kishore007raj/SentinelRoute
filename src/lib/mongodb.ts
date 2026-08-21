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
  var _mongoIndexesEnsured: boolean | undefined;
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
  
  // Configure connection pooling and timeouts for better concurrency
  // maxPoolSize: set to 50 for optimal concurrency without connection pool exhaustion on Atlas
  // serverSelectionTimeoutMS: fail fast if MongoDB Atlas is unreachable (10s)
  // socketTimeoutMS: connection timeout for individual operations (15s)
  const uriWithOptions = uri.includes("?") 
    ? `${uri}&maxPoolSize=50&serverSelectionTimeoutMS=10000&socketTimeoutMS=15000`
    : `${uri}?maxPoolSize=50&serverSelectionTimeoutMS=10000&socketTimeoutMS=15000`;
  
  console.log("[mongodb] Creating client with options: maxPoolSize=50, serverSelectionTimeoutMS=10s, socketTimeoutMS=15s");
  const client = new MongoClient(uriWithOptions);
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
 * Returns the sentinelroute Db instance with bounded connection timeout.
 * Reuses the cached MongoClient - never opens a second connection.
 * Triggers index creation on first call (idempotent, fire-and-forget, once per process).
 * 
 * @param timeoutMs - Maximum time to wait for MongoDB connection (default: 10s)
 * @throws Error if connection times out or MongoDB is unavailable
 */
export async function getDb(timeoutMs = 10_000): Promise<Db> {
  const connectStart = Date.now();
  const connectPromise = getClientPromise();
  
  // Race between connection and timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("[mongodb] Connection timeout")), timeoutMs)
  );

  const client = await Promise.race([connectPromise, timeoutPromise]);
  const connectTime = Date.now() - connectStart;
  if (connectTime > 100) {
    console.log(`[mongodb] getClientPromise took ${connectTime}ms (possible pool exhaustion or contention)`);
  }

  const db = client.db(dbName);

  if (!global._mongoIndexesEnsured) {
    global._mongoIndexesEnsured = true;
    ensureIndexes(db).catch(() => {/* logged inside ensureIndexes */});
    ensureWorkforceIndexes(db).catch(() => {/* logged inside ensureWorkforceIndexes */});
  }

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
