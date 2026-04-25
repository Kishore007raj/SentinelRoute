export interface OsrmRoute {
  distanceKm: number;
  durationHours: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][]; // [lng, lat]
  };
}

export async function getOsrmRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<OsrmRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    return {
      distanceKm: route.distance / 1000,
      durationHours: route.duration / 3600,
      geometry: route.geometry,
    };
  } catch (error) {
    console.error("OSRM Route Error:", error);
    return null;
  }
}

// Simple Geocoding helper using Nominatim
export async function geocode(city: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SentinelRoute-App"
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.length === 0) return null;
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}
