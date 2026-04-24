/**
 * firestore.ts — Firestore helper functions for the shipments collection.
 *
 * Collection: "shipments"
 * Document fields match the Shipment type from src/lib/types.ts
 *
 * All reads are filtered by userId so each user only sees their own data.
 */

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Shipment, ShipmentStatus } from "./types";

const COLLECTION = "shipments";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function docToShipment(d: QueryDocumentSnapshot<DocumentData>): Shipment {
  const data = d.data();
  return {
    id: d.id,
    shipmentCode:     data.shipmentCode     ?? "",
    origin:           data.origin           ?? "",
    destination:      data.destination      ?? "",
    selectedRoute:    data.selectedRoute    ?? "balanced",
    routeName:        data.routeName        ?? "",
    riskScore:        data.riskScore        ?? 0,
    riskLevel:        data.riskLevel        ?? "low",
    eta:              data.eta              ?? "",
    status:           data.status           ?? "active",
    lastUpdate:       data.lastUpdate       ?? "",
    cargoType:        data.cargoType        ?? "",
    vehicleType:      data.vehicleType      ?? "",
    distance:         data.distance         ?? "",
    departureTime:    data.departureTime    ?? "",
    confidencePercent: data.confidencePercent ?? 0,
    predictiveAlert:  data.predictiveAlert  ?? undefined,
    userId:           data.userId           ?? "",
    createdAt:        data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? "",
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Persists a new shipment to Firestore.
 * Returns the Firestore-assigned document ID.
 */
export async function createShipmentDoc(
  shipment: Omit<Shipment, "id">,
  userId: string
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...shipment,
    userId,
    createdAt: serverTimestamp(),
    lastUpdate: "just now",
  });
  return ref.id;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetches all shipments for a given user, ordered by creation time (newest first).
 */
export async function getShipmentsByUser(userId: string): Promise<Shipment[]> {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToShipment);
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Updates the status of a shipment document.
 */
export async function updateShipmentStatus(
  shipmentId: string,
  status: ShipmentStatus
): Promise<void> {
  const ref = doc(db, COLLECTION, shipmentId);
  await updateDoc(ref, {
    status,
    lastUpdate: "just now",
  });
}
