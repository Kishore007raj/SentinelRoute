import { getDb } from "./mongodb";
import { Incident, IncidentCategory } from "./types";



/**
 * Fetches active incidents.
 * Mocks live API data by generating them deterministically and combining with DB stored incidents.
 */
export async function getActiveIncidents(companyId?: string): Promise<Incident[]> {
  const db = await getDb();
  
  // Base query: global incidents (companyId null/missing) or company specific
  const query = companyId ? { $or: [{ companyId: null }, { companyId: { $exists: false } }, { companyId }] } : {};
  
  const [dbIncidents, eventIncidents] = await Promise.all([
    db.collection("incidents").find(query).toArray(),
    db.collection("incident_events").find(query).toArray(),
  ]);

  const mappedDbIncidents = dbIncidents.map(doc => {
    const { _id, ...rest } = doc;
    return rest as unknown as Incident;
  });

  const mappedEventIncidents = eventIncidents.map(doc => {
    const { _id, ...rest } = doc;
    return rest as unknown as Incident;
  });

  // Combine DB stored and event incidents
  const dbIds = new Set(mappedDbIncidents.map(i => i.incidentId));
  const finalIncidents = [...mappedDbIncidents];
  
  for (const ev of mappedEventIncidents) {
    if (!dbIds.has(ev.incidentId)) {
      finalIncidents.push(ev);
      dbIds.add(ev.incidentId);
    }
  }

  return finalIncidents;
}

export async function storeIncident(incident: Incident): Promise<void> {
  const db = await getDb();
  await db.collection("incidents").updateOne(
    { incidentId: incident.incidentId },
    { $set: incident },
    { upsert: true }
  );
}
