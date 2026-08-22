import { NextRequest, NextResponse } from "next/server";
import { geoapifyRoute } from "@/lib/geoapify";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import { verifyFirebaseToken } from "@/lib/firebase-admin";

/**
 * GET /api/geoapify/route
 *
 * Fetches the fastest driving route geometry from Geoapify.
 * Used by CorridorMapPreview to render a real road path instead of a
 * straight line between origin and destination.
 *
 * Query params:
 *   originLat, originLng, destLat, destLng  (all required, numeric)
 *
 * Response:
 *   { geometry: [number, number][] }  — [lat, lng] pairs for Leaflet
 *
 * Returns 200 with geometry: [] if Geoapify is unavailable (client falls back
 * to the straight-line preview).
 */
export async function GET(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req);
  const rl = apiLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  // Auth required — prevents anonymous API key scraping
  try {
    await verifyFirebaseToken(req);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(req.url);
  const oLat = parseFloat(url.searchParams.get("originLat") ?? "");
  const oLng = parseFloat(url.searchParams.get("originLng") ?? "");
  const dLat = parseFloat(url.searchParams.get("destLat") ?? "");
  const dLng = parseFloat(url.searchParams.get("destLng") ?? "");

  if (
    !isFinite(oLat) || !isFinite(oLng) ||
    !isFinite(dLat) || !isFinite(dLng)
  ) {
    return NextResponse.json(
      { error: "originLat, originLng, destLat, destLng are all required and must be numbers" },
      { status: 400 }
    );
  }

  try {
    // geoapifyRoute returns geometry in [lng, lat] GeoJSON order.
    // Convert to [lat, lng] for Leaflet before sending to the client.
    const routes = await geoapifyRoute(oLng, oLat, dLng, dLat);
    const fastest = routes[0];

    if (!fastest || fastest.geometry.length < 2) {
      // Geoapify unavailable or returned nothing — client uses straight-line fallback
      return NextResponse.json({ geometry: [] });
    }

    // Convert [lng, lat] → [lat, lng] for Leaflet
    const geometry: [number, number][] = fastest.geometry.map(
      ([lng, lat]) => [lat, lng]
    );

    return NextResponse.json({ geometry }, {
      headers: {
        // Cache for 5 minutes — same origin/dest always returns the same road path
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[GET /api/geoapify/route]", err);
    // Non-fatal: client falls back to straight line
    return NextResponse.json({ geometry: [] });
  }
}
