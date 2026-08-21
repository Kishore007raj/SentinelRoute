import { Server as SocketIOServer } from "socket.io";
import { getDb } from "./mongodb";
import { logger } from "./logger";
import type { ChangeStream } from "mongodb";

// ─── Resume token persistence ─────────────────────────────────────────────────
// Tokens are stored in _change_stream_tokens with a "name" field (not _id)
// as the lookup key, since _id expects ObjectId in strict type contexts.

async function getResumeToken(collectionName: string): Promise<unknown> {
  const db = await getDb();
  const doc = await db
    .collection("_change_stream_tokens")
    .findOne({ name: collectionName });
  return doc ? doc.token : undefined;
}

async function saveResumeToken(collectionName: string, token: unknown): Promise<void> {
  const db = await getDb();
  await db.collection("_change_stream_tokens").updateOne(
    { name: collectionName },
    { $set: { name: collectionName, token, updatedAt: new Date() } },
    { upsert: true }
  );
}

// ─── Per-collection watcher ───────────────────────────────────────────────────

async function watchCollection(
  collectionName: string,
  io: SocketIOServer,
  onEvent: (change: unknown, io: SocketIOServer) => void
): Promise<void> {
  let retryCount = 0;
  // Tracks the most-recently created stream so the "close" handler can
  // distinguish its own stream from stale streams left over from previous
  // connect() calls. This is the key guard that prevents the double-reconnect
  // storm: when the "error" handler calls stream.close(), the resulting "close"
  // event is suppressed because currentStream is set to null before reconnect()
  // is scheduled, meaning only one reconnect timer is ever queued per failure.
  let currentStream: ChangeStream | null = null;

  async function connect(): Promise<void> {
    try {
      const db = await getDb();
      const resumeToken = await getResumeToken(collectionName);
      const options: Record<string, unknown> = { fullDocument: "updateLookup" };
      if (resumeToken) {
        options.resumeAfter = resumeToken;
      }

      const stream = db.collection(collectionName).watch([], options);
      currentStream = stream;

      stream.on("change", async (change) => {
        // Successful event — reset the backoff counter.
        retryCount = 0;

        if (
          change.operationType === "insert" ||
          change.operationType === "update" ||
          change.operationType === "replace"
        ) {
          onEvent(change, io);
        }

        // Persist the resume token after dispatching the event.
        if (change._id) {
          await saveResumeToken(collectionName, change._id).catch((err: Error) => {
            logger.error(`change_streams.token_save_error`, {
              collection: collectionName,
              error: err.message,
            });
          });
        }
      });

      stream.on("error", (err: Error) => {
        logger.error(`change_streams.error`, {
          collection: collectionName,
          error: err.message,
        });
        // Null out currentStream BEFORE calling stream.close() so the "close"
        // handler that fires as a result of close() sees currentStream !== stream
        // and does NOT schedule a second reconnect timer.
        currentStream = null;
        stream.close().catch(() => {});
        reconnect();
      });

      stream.on("close", () => {
        // Only reconnect if this event belongs to the stream we are currently
        // tracking. Stale "close" events from previously replaced streams are
        // ignored, preventing exponential listener/timer multiplication.
        if (currentStream !== stream) return;
        currentStream = null;
        logger.warn(`change_streams.closed`, { collection: collectionName });
        reconnect();
      });

      logger.info(`change_streams.connected`, { collection: collectionName });
    } catch (error) {
      currentStream = null;
      logger.error(`change_streams.setup_error`, {
        collection: collectionName,
        error: (error as Error).message,
      });
      reconnect();
    }
  }

  function reconnect(): void {
    retryCount++;
    const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 60_000); // max 1 minute
    logger.info(`change_streams.reconnecting`, {
      collection: collectionName,
      retryCount,
      backoffMs,
    });
    setTimeout(connect, backoffMs);
  }

  connect();
}

// ─── Singleton guard ──────────────────────────────────────────────────────────
// Prevents duplicate change stream watchers if setupChangeStreams() is called
// more than once in the same process (e.g. during development hot-reload or an
// accidental double-import in server.ts).

let changeStreamsInitialized = false;

export async function setupChangeStreams(io: SocketIOServer): Promise<void> {
  if (changeStreamsInitialized) {
    logger.warn("change_streams.setup_skipped", {
      message:
        "setupChangeStreams() was called more than once in this process — skipping duplicate initialization.",
    });
    return;
  }
  changeStreamsInitialized = true;

  // ── Collection watchers ───────────────────────────────────────────────────

  watchCollection("shipments", io, (change, io) => {
    const c = change as { operationType: string; fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      const eventType = c.operationType === "insert" ? "shipment:created" : "shipment:updated";
      io.to(`company:${doc.companyId}`).emit(eventType, { shipment: doc });
    }
  });

  watchCollection("shipment_executions", io, (change, io) => {
    const c = change as { fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("execution:updated", { execution: doc });
      io.to(`entity:${doc.shipmentId}`).emit("execution:updated", { execution: doc });
    }
  });

  watchCollection("incidents", io, (change, io) => {
    const c = change as { operationType: string; fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      const eventType = c.operationType === "insert" ? "incident:created" : "incident:updated";
      io.to(`company:${doc.companyId}`).emit(eventType, { incident: doc });
      io.to(`company:${doc.companyId}`).emit("feed:updated", { type: "incident", id: doc.incidentId });
    }
  });

  watchCollection("operational_alerts", io, (change, io) => {
    const c = change as { operationType: string; fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      const eventType = c.operationType === "insert" ? "alert:created" : "alert:updated";
      io.to(`company:${doc.companyId}`).emit(eventType, { alert: doc });
      io.to(`company:${doc.companyId}`).emit("feed:updated", { type: "alert", id: doc.alertId });
    }
  });

  watchCollection("drivers", io, (change, io) => {
    const c = change as { fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("driver:updated", { driver: doc });
      io.to(`company:${doc.companyId}`).emit("driver:availability", {
        driverId: doc.driverId,
        operationalStatus: doc.operationalStatus,
      });
    }
  });

  watchCollection("vehicles", io, (change, io) => {
    const c = change as { fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("vehicle:updated", { vehicle: doc });
    }
  });

  watchCollection("operational_recommendations", io, (change, io) => {
    const c = change as { fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("recommendation:updated", { recommendation: doc });
      io.to(`company:${doc.companyId}`).emit("feed:updated", {
        type: "recommendation",
        id: doc.recommendationId,
      });
    }
  });

  watchCollection("shipment_messages", io, (change, io) => {
    const c = change as { fullDocument?: Record<string, unknown> };
    const doc = c.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("message:created", { message: doc });
      io.to(`entity:${doc.shipmentId}`).emit("message:created", { message: doc });
    }
  });

  logger.info("change_streams.ready", {
    message: "MongoDB Change Streams with resume token persistence successfully initialized",
  });
}
