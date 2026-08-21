import { Server as SocketIOServer } from "socket.io";
import { getDb } from "./mongodb";
import { logger } from "./logger";
import { ChangeStream, Document, ChangeStreamInsertDocument, ChangeStreamUpdateDocument, ChangeStreamReplaceDocument } from "mongodb";

// P2-001 & P2-002 Fix: Persistent Change Streams with Auto-Reconnect

async function getResumeToken(collectionName: string) {
  const db = await getDb();
  const doc = await db.collection("_change_stream_tokens").findOne({ _id: collectionName as any });
  return doc ? doc.token : undefined;
}

async function saveResumeToken(collectionName: string, token: any) {
  const db = await getDb();
  await db.collection("_change_stream_tokens").updateOne(
    { _id: collectionName as any },
    { $set: { token, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function watchCollection(
  collectionName: string, 
  io: SocketIOServer, 
  onEvent: (change: any, io: SocketIOServer) => void
) {
  let retryCount = 0;
  
  async function connect() {
    try {
      const db = await getDb();
      const resumeToken = await getResumeToken(collectionName);
      const options: any = { fullDocument: "updateLookup" };
      if (resumeToken) {
        options.resumeAfter = resumeToken;
      }
      
      const stream = db.collection(collectionName).watch([], options);
      
      stream.on("change", async (change) => {
        // Reset retry count on successful event
        retryCount = 0; 
        
        if (
          change.operationType === "insert" ||
          change.operationType === "update" ||
          change.operationType === "replace"
        ) {
          onEvent(change, io);
        }
        
        // Persist token for recovery
        if (change._id) {
          await saveResumeToken(collectionName, change._id).catch(err => {
            logger.error(`change_streams.token_save_error`, { collection: collectionName, error: err.message });
          });
        }
      });
      
      stream.on("error", (err) => {
        logger.error(`change_streams.error`, { collection: collectionName, error: err.message });
        stream.close().catch(() => {});
        reconnect();
      });
      
      stream.on("close", () => {
        logger.warn(`change_streams.closed`, { collection: collectionName });
        reconnect();
      });
      
      logger.info(`change_streams.connected`, { collection: collectionName });
    } catch (error) {
      logger.error(`change_streams.setup_error`, { collection: collectionName, error: (error as Error).message });
      reconnect();
    }
  }
  
  function reconnect() {
    retryCount++;
    const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 60000); // Max 1 minute
    logger.info(`change_streams.reconnecting`, { collection: collectionName, retryCount, backoffMs });
    setTimeout(connect, backoffMs);
  }
  
  connect();
}

export async function setupChangeStreams(io: SocketIOServer) {
  // Watch shipments collection
  watchCollection("shipments", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      const eventType = change.operationType === "insert" ? "shipment:created" : "shipment:updated";
      io.to(`company:${doc.companyId}`).emit(eventType, { shipment: doc });
    }
  });

  // Watch shipment_executions collection
  watchCollection("shipment_executions", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("execution:updated", { execution: doc });
      io.to(`entity:${doc.shipmentId}`).emit("execution:updated", { execution: doc });
    }
  });

  // Watch incidents collection
  watchCollection("incidents", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      const eventType = change.operationType === "insert" ? "incident:created" : "incident:updated";
      io.to(`company:${doc.companyId}`).emit(eventType, { incident: doc });
      io.to(`company:${doc.companyId}`).emit("feed:updated", { type: "incident", id: doc.incidentId });
    }
  });

  // Watch operational_alerts collection
  watchCollection("operational_alerts", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      const eventType = change.operationType === "insert" ? "alert:created" : "alert:updated";
      io.to(`company:${doc.companyId}`).emit(eventType, { alert: doc });
      io.to(`company:${doc.companyId}`).emit("feed:updated", { type: "alert", id: doc.alertId });
    }
  });

  // Watch drivers collection
  watchCollection("drivers", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("driver:updated", { driver: doc });
      io.to(`company:${doc.companyId}`).emit("driver:availability", { driverId: doc.driverId, operationalStatus: doc.operationalStatus });
    }
  });

  // Watch vehicles collection
  watchCollection("vehicles", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("vehicle:updated", { vehicle: doc });
    }
  });

  // Watch operational_recommendations collection
  watchCollection("operational_recommendations", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("recommendation:updated", { recommendation: doc });
      io.to(`company:${doc.companyId}`).emit("feed:updated", { type: "recommendation", id: doc.recommendationId });
    }
  });

  // Watch shipment_messages collection
  watchCollection("shipment_messages", io, (change, io) => {
    const doc = change.fullDocument;
    if (doc && doc.companyId) {
      io.to(`company:${doc.companyId}`).emit("message:created", { message: doc });
      io.to(`entity:${doc.shipmentId}`).emit("message:created", { message: doc });
    }
  });

  logger.info("change_streams.ready", { message: "MongoDB Change Streams with resume token persistence successfully initialized" });
}
