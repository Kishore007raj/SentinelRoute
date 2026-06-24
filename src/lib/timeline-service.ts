import { getDb } from "./mongodb";
import { ShipmentTimelineEvent, TimelineEventType } from "./types";

/**
 * Appends an immutable event to a shipment's timeline.
 */
export async function addTimelineEvent(
  shipmentId: string,
  companyId: string,
  type: TimelineEventType,
  description: string,
  source: string,
  confidence: number = 100,
  affectedMetrics?: string[]
): Promise<ShipmentTimelineEvent> {
  const event: ShipmentTimelineEvent = {
    eventId: `evt-${shipmentId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    shipmentId,
    companyId,
    timestamp: new Date().toISOString(),
    type,
    description,
    source,
    confidence,
    affectedMetrics,
  };

  const db = await getDb();
  await db.collection("shipment_timelines").insertOne(event);

  return event;
}

/**
 * Retrieves the full immutable timeline for a shipment.
 */
export async function getShipmentTimeline(shipmentId: string): Promise<ShipmentTimelineEvent[]> {
  const db = await getDb();
  const events = await db.collection("shipment_timelines")
    .find({ shipmentId })
    .sort({ timestamp: -1 })
    .toArray();

  return events.map(doc => {
    const { _id, ...rest } = doc;
    return rest as unknown as ShipmentTimelineEvent;
  });
}
