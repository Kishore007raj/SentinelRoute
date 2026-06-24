/**
 * GET /api/mappls/autosuggest?q=<query>
 *
 * Proxies Mappls autosuggest from the server so MAPPLS_API_KEY
 * is never exposed to the client. Called by MapplsLocationInput.
 */

import { NextRequest, NextResponse } from "next/server";
import { mapplsAutosuggest } from "@/lib/mappls";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const suggestions = await mapplsAutosuggest(q);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[api/mappls/autosuggest] Error:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
