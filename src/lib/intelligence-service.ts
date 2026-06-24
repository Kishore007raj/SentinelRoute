import { getDb } from "./mongodb";
import { Incident, IncidentCategory } from "./types";

// Coordinates for deterministic generation
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  Chennai:     { lat: 13.0827, lon: 80.2707 },
  Bangalore:   { lat: 12.9716, lon: 77.5946 },
  Hyderabad:   { lat: 17.3850, lon: 78.4867 },
  Pune:        { lat: 18.5204, lon: 73.8567 },
  Mumbai:      { lat: 19.0760, lon: 72.8777 },
  Coimbatore:  { lat: 11.0168, lon: 76.9558 },
  Salem:       { lat: 11.6643, lon: 78.1460 },
  Thrissur:    { lat: 10.5276, lon: 76.2144 },
  Vijayawada:  { lat: 16.5062, lon: 80.6480 },
};

/**
 * Deterministically generates incidents based on a city.
 * In production, this would fetch from Mappls/NHAI/Gov feeds.
 */
function generateDeterministicIncidentsForCity(city: string): Incident[] {
  const coords = CITY_COORDS[city];
  if (!coords) return [];

  // Simple deterministic pseudo-random logic based on city name length and char codes
  const seed = city.charCodeAt(0) + city.charCodeAt(city.length - 1);
  const numIncidents = (seed % 3) + 1; // 1 to 3 incidents

  const categories: IncidentCategory[] = ["Traffic", "Road Closure", "Construction", "Weather", "Restriction"];
  const severities: ("low" | "medium" | "high" | "critical")[] = ["low", "medium", "high", "critical"];
  
  const incidents: Incident[] = [];
  const now = new Date();

  for (let i = 0; i < numIncidents; i++) {
    const latOffset = ((seed * (i + 1)) % 100) / 1000 - 0.05; // -0.05 to +0.05
    const lonOffset = ((seed * (i + 2)) % 100) / 1000 - 0.05;

    const category = categories[(seed + i) % categories.length];
    const severity = severities[(seed + i) % severities.length];

    incidents.push({
      incidentId: `inc-${city.toLowerCase()}-${i}`,
      title: `${category} reported near ${city}`,
      description: `Ongoing ${category.toLowerCase()} affecting local routes. Expect delays.`,
      category,
      severity,
      confidence: 70 + (seed % 30), // 70 to 99
      latitude: coords.lat + latOffset,
      longitude: coords.lon + lonOffset,
      affectedRadiusKm: (seed % 10) + 1,
      startTime: new Date(now.getTime() - ((seed * 10) * 60000)).toISOString(), // past few hours
      lastUpdated: now.toISOString(),
      source: category === "Weather" ? "OpenWeather" : "NHAI Feed",
      verifiedStatus: true,
      impactScore: severity === "critical" ? 95 : severity === "high" ? 75 : severity === "medium" ? 50 : 25,
      recommendedAction: severity === "critical" ? "Reroute immediately" : "Proceed with caution",
    });
  }

  return incidents;
}

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

  // Deterministic mock generation to ensure the heatmap and tables always have data
  const simulatedIncidents: Incident[] = [];
  for (const city of Object.keys(CITY_COORDS)) {
    simulatedIncidents.push(...generateDeterministicIncidentsForCity(city));
  }

  // Combine DB stored, event incidents and simulated, prioritizing DB stored, then events, then simulated
  const dbIds = new Set(mappedDbIncidents.map(i => i.incidentId));
  const finalIncidents = [...mappedDbIncidents];
  
  for (const ev of mappedEventIncidents) {
    if (!dbIds.has(ev.incidentId)) {
      finalIncidents.push(ev);
      dbIds.add(ev.incidentId);
    }
  }

  for (const sim of simulatedIncidents) {
    if (!dbIds.has(sim.incidentId)) {
      finalIncidents.push(sim);
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
