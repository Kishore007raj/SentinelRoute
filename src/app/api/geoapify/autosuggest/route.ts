/**
 * GET /api/geoapify/autosuggest?q=<query>
 *
 * Proxies Geoapify autosuggest from the server so GEOAPIFY_API_KEY
 * is never exposed to the client. Called by GeoapifyLocationInput.
 */

import { NextRequest, NextResponse } from "next/server";
import { geoapifyAutosuggest } from "@/lib/geoapify";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const suggestions = await geoapifyAutosuggest(q);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[api/geoapify/autosuggest] Error:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
