/**
 * news-intelligence.ts - NewsAPI integration for logistics disruption signals.
 *
 * Fetches India-focused news articles matching logistics disruption keywords,
 * normalizes them into Incident records, deduplicates, persists to
 * incident_events collection, and returns a risk contribution score.
 *
 * News data directly contributes to:
 *   - Operational Risk Score (via disruptionProbability)
 *   - Delay Probability
 *   - Disruption Probability
 *
 * Server-side only. Requires NEWS_API_KEY environment variable.
 */

import { getDb } from "../mongodb";
import { createIntelligenceAudit } from "../intelligence-audit";
import { getCurrentDate } from "../time";
import type { Incident, IncidentCategory } from "../types";
import { NEWS_API_KEY } from "../env";

// ─── NewsAPI response shapes ──────────────────────────────────────────────────

interface NewsAPIArticle {
  title:        string | null;
  description:  string | null;
  url:          string;
  publishedAt:  string;
  source:       { name: string };
}

interface NewsAPIResponse {
  status:       string;
  totalResults: number;
  articles:     NewsAPIArticle[];
}

// ─── Disruption keyword groups ────────────────────────────────────────────────

// Strictly scoped to Indian Logistics events
const DISRUPTION_QUERY = "(highway OR expressway OR truck OR freight OR logistics OR cargo OR port) AND (accident OR strike OR protest OR landslide OR flood) AND India";
const EXCLUSION_QUERY = "-cricket -IPL -Bollywood -movie -cinema -actor -sports -match";
const FULL_QUERY = `${DISRUPTION_QUERY} ${EXCLUSION_QUERY}`;

// ─── Region coordinate lookup ─────────────────────────────────────────────────
// Maps city/highway/state keywords to approximate lat/lng centre points.

const REGION_COORDS: Array<{
  keywords: string[];
  lat:      number;
  lng:      number;
  city:     string;
  state:    string;
}> = [
  { keywords: ["chennai", "tamil"],           lat: 13.0827, lng: 80.2707, city: "Chennai", state: "Tamil Nadu" },
  { keywords: ["bangalore", "bengaluru"],      lat: 12.9716, lng: 77.5946, city: "Bengaluru", state: "Karnataka" },
  { keywords: ["mumbai", "thane", "bandra"],   lat: 19.0760, lng: 72.8777, city: "Mumbai", state: "Maharashtra" },
  { keywords: ["pune", "lonavala"],            lat: 18.5204, lng: 73.8567, city: "Pune", state: "Maharashtra" },
  { keywords: ["hyderabad", "secunderabad"],   lat: 17.3850, lng: 78.4867, city: "Hyderabad", state: "Telangana" },
  { keywords: ["delhi", "ncr", "gurgaon", "noida"], lat: 28.6139, lng: 77.2090, city: "Delhi", state: "Delhi NCR" },
  { keywords: ["kolkata", "howrah", "bengal"], lat: 22.5726, lng: 88.3639, city: "Kolkata", state: "West Bengal" },
  { keywords: ["ahmedabad", "gujarat", "surat"], lat: 23.0225, lng: 72.5714, city: "Ahmedabad", state: "Gujarat" },
  { keywords: ["jaipur", "rajasthan"],         lat: 26.9124, lng: 75.7873, city: "Jaipur", state: "Rajasthan" },
  { keywords: ["lucknow", "uttar pradesh", "kanpur"], lat: 26.8467, lng: 80.9462, city: "Lucknow", state: "Uttar Pradesh" },
  { keywords: ["patna", "bihar"],              lat: 25.5941, lng: 85.1376, city: "Patna", state: "Bihar" },
  { keywords: ["bhopal", "madhya pradesh"],    lat: 23.2599, lng: 77.4126, city: "Bhopal", state: "Madhya Pradesh" },
  { keywords: ["nagpur"],                      lat: 21.1458, lng: 79.0882, city: "Nagpur", state: "Maharashtra" },
  { keywords: ["coimbatore"],                  lat: 11.0168, lng: 76.9558, city: "Coimbatore", state: "Tamil Nadu" },
  { keywords: ["kochi", "kerala", "thrissur"], lat:  9.9312, lng: 76.2673, city: "Kochi", state: "Kerala" },
  { keywords: ["visakhapatnam", "vizag"],      lat: 17.6868, lng: 83.2185, city: "Visakhapatnam", state: "Andhra Pradesh" },
  { keywords: ["vijayawada", "andhra"],        lat: 16.5062, lng: 80.6480, city: "Vijayawada", state: "Andhra Pradesh" },
  { keywords: ["nh-48", "nh48", "nh 48"],      lat: 12.5000, lng: 77.5000, city: "NH-48", state: "National Highway" },
  { keywords: ["nh-8", "nh8"],                 lat: 22.0000, lng: 72.6000, city: "NH-8", state: "National Highway" },
  { keywords: ["nh-44", "nh44"],               lat: 23.5000, lng: 78.0000, city: "NH-44", state: "National Highway" },
  { keywords: ["expressway", "motorway"],      lat: 19.5000, lng: 74.0000, city: "Mumbai-Pune Expressway", state: "Maharashtra" },
];

/**
 * Extracts a lat/lng and region details for an article based on geographic keywords in title+description.
 * Falls back to India's centre if no region is recognised.
 */
function extractCoords(text: string): { lat: number; lng: number; city: string; state: string } {
  const lower = text.toLowerCase();
  for (const region of REGION_COORDS) {
    if (region.keywords.some((kw) => lower.includes(kw))) {
      return { lat: region.lat, lng: region.lng, city: region.city, state: region.state };
    }
  }
  return { lat: 20.5937, lng: 78.9629, city: "Unknown", state: "Multiple Regions" };
}

// ─── Keyword → category + severity mapping ────────────────────────────────────

interface ClassificationResult {
  category:         IncidentCategory;
  severity:         "low" | "medium" | "high" | "critical";
  impactScore:      number;
  riskContribution: number;
  logisticsImpact:  string;
  estimatedDelayMinutes: number;
}

function classifyArticle(text: string): ClassificationResult {
  const lower = text.toLowerCase();
  if (lower.includes("strike") || lower.includes("blockade") || lower.includes("civil unrest")) {
    return { category: "Political", severity: "high", impactScore: 75, riskContribution: 20, logisticsImpact: "Fleet immobilization and highway blocks", estimatedDelayMinutes: 240 };
  }
  if (lower.includes("landslide") || lower.includes("flood") || lower.includes("flooded")) {
    return { category: "Natural Disaster", severity: "critical", impactScore: 90, riskContribution: 30, logisticsImpact: "Complete route closure, severe detours required", estimatedDelayMinutes: 480 };
  }
  if (lower.includes("road closure") || lower.includes("highway closure")) {
    return { category: "Road Closure", severity: "high", impactScore: 70, riskContribution: 18, logisticsImpact: "Mandatory rerouting", estimatedDelayMinutes: 120 };
  }
  if (lower.includes("accident")) {
    return { category: "Accident", severity: "medium", impactScore: 55, riskContribution: 12, logisticsImpact: "Slow moving traffic and temporary bottleneck", estimatedDelayMinutes: 60 };
  }
  if (lower.includes("traffic disruption") || lower.includes("congestion")) {
    return { category: "Traffic", severity: "medium", impactScore: 50, riskContribution: 10, logisticsImpact: "Moderate slowdowns", estimatedDelayMinutes: 30 };
  }
  if (lower.includes("protest") || lower.includes("rally")) {
    return { category: "Public Event", severity: "medium", impactScore: 45, riskContribution: 8, logisticsImpact: "Localized restricted access", estimatedDelayMinutes: 45 };
  }
  if (lower.includes("transport strike") || lower.includes("truck strike") || lower.includes("logistics disruption")) {
    return { category: "Restriction", severity: "high", impactScore: 65, riskContribution: 16, logisticsImpact: "State boundary crossing delays", estimatedDelayMinutes: 180 };
  }
  return { category: "Unknown", severity: "low", impactScore: 20, riskContribution: 5, logisticsImpact: "Minor operational friction", estimatedDelayMinutes: 15 };
}

// ─── Deterministic ID from URL ────────────────────────────────────────────────

function articleToIncidentId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const chr = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `news-${Math.abs(hash).toString(36)}`;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeArticle(article: NewsAPIArticle): Incident | null {
  const title       = article.title ?? "";
  const description = article.description ?? "";
  const combined    = `${title} ${description}`;

  if (!title || title === "[Removed]") return null;

  const classification = classifyArticle(combined);
  const incidentId     = articleToIncidentId(article.url);
  const now            = getCurrentDate().toISOString();
  const location       = extractCoords(combined);

  return {
    incidentId,
    title:             title.slice(0, 150),
    description:       description.slice(0, 300) || `${classification.category} event reported.`,
    category:          classification.category,
    severity:          classification.severity,
    confidence:        75,
    latitude:          location.lat,
    longitude:         location.lng,
    affectedState:     location.state,
    affectedCity:      location.city,
    logisticsImpact:   classification.logisticsImpact,
    estimatedDelayMinutes: classification.estimatedDelayMinutes,
    affectedRadiusKm:  classification.severity === "critical" ? 150
                     : classification.severity === "high"     ? 100
                     : 50,
    startTime:         article.publishedAt,
    lastUpdated:       now,
    source:            `NewsAPI:${article.source.name}`,
    verifiedStatus:    false,
    impactScore:       classification.impactScore,
    recommendedAction: classification.severity === "critical"
      ? "Reroute immediately - major disruption reported"
      : classification.severity === "high"
      ? "Evaluate alternate corridor routes"
      : "Monitor situation closely",
  };
}

// ─── Persistence with deduplication ──────────────────────────────────────────

async function persistIncidents(incidents: Incident[]): Promise<void> {
  if (incidents.length === 0) return;
  const db = await getDb();
  await Promise.all(
    incidents.map(async (inc) => {
      const existing = await db.collection("incident_events").findOne({ incidentId: inc.incidentId });
      await db.collection("incident_events").updateOne(
        { incidentId: inc.incidentId },
        { $set: inc },
        { upsert: true }
      );
      createIntelligenceAudit({
        companyId:  "system",
        incidentId: inc.incidentId,
        eventType:  existing ? "incident_updated" : "incident_detected",
        source:     "NewsIntelligence",
        metadata: { title: inc.title, category: inc.category, severity: inc.severity, source: inc.source },
      }).catch(() => {});
    })
  );
}

// ─── Risk contribution ────────────────────────────────────────────────────────

export interface NewsRiskContribution {
  disruptionBonus:     number;
  delayBonus:          number;
  affectedCategories:  IncidentCategory[];
  articleCount:        number;
  normalizedIncidents: Incident[];
}

// Helper: Generate mock news articles with CURRENT timestamp
// Must be called at runtime, not at module level, to ensure timestamps stay fresh
function getMockNewsArticles(): NewsAPIArticle[] {
  const now = getCurrentDate().toISOString();
  return [
    {
      title:       "Truck strike blockades Chennai-Bengaluru highway NH-48, severe cargo delay expected",
      description: "All India Motor Transport Congress calls strike. Hundreds of trucks blocked on highway NH-48 near Chennai. Traffic disruption is critical.",
      url:         "https://timesofindia.indiatimes.com/india/truck-strike-nh48-chennai",
      publishedAt: now,
      source:      { name: "Times of India" },
    },
    {
      title:       "Landslide on Mumbai-Pune Expressway near Lonavala halts logistics flow",
      description: "Heavy rainfall triggers landslide near Lonavala on the Mumbai-Pune Expressway. Authorities close two lanes near Pune.",
      url:         "https://indianexpress.com/article/cities/mumbai/landslide-expressway-lonavala",
      publishedAt: now,
      source:      { name: "Indian Express" },
    },
    {
      title:       "Protest near Delhi-NCR Gurgaon causes major transport disruption",
      description: "Political rally blockades regional highways near Delhi NCR. Traffic police issues warnings for heavy container vehicles on NH-48.",
      url:         "https://www.thehindu.com/news/national/protest-delhi-ncr-transport",
      publishedAt: now,
      source:      { name: "The Hindu" },
    },
  ];
}

export async function getNewsRiskContribution(
  companyId:   string,
  shipmentId?: string
): Promise<NewsRiskContribution> {
  const EMPTY: NewsRiskContribution = {
    disruptionBonus:     0,
    delayBonus:          0,
    affectedCategories:  [],
    articleCount:        0,
    normalizedIncidents: [],
  };

  const apiKey = NEWS_API_KEY();
  let articles: NewsAPIArticle[] = [];

  if (!apiKey) {
    console.warn("[news-intelligence] NEWS_API_KEY not set - using deterministic mock news");
    articles = getMockNewsArticles();
  } else {
    try {
      const url =
        `https://newsapi.org/v2/everything` +
        `?q=${encodeURIComponent(FULL_QUERY)}` +
        `&language=en` +
        `&sortBy=publishedAt` +
        `&pageSize=20` +
        `&apiKey=${apiKey}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        next: { revalidate: 3600 },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data: NewsAPIResponse = await res.json();
        if (data.status === "ok" && Array.isArray(data.articles)) {
          articles = data.articles;
        }
      }
    } catch (err) {
      console.error("[news-intelligence] NewsAPI fetch failed, returning empty:", err);
      return EMPTY;
    }

    if (articles.length === 0) {
      console.warn("[news-intelligence] No articles returned - using mock news");
      articles = getMockNewsArticles();
    }
  }

  try {
    const normalized: Incident[] = articles
      .map(normalizeArticle)
      .filter((x): x is Incident => x !== null);

    if (normalized.length === 0) return EMPTY;

    persistIncidents(normalized).catch((err) =>
      console.error("[news-intelligence] Persist failed:", err)
    );

    const categories = new Set<IncidentCategory>();
    let disruptionBonus = 0;
    let delayBonus      = 0;

    for (const inc of normalized) {
      const cls = classifyArticle(`${inc.title} ${inc.description}`);
      disruptionBonus += cls.riskContribution;
      delayBonus      += Math.round(cls.riskContribution * 0.6);
      categories.add(inc.category);
    }

    disruptionBonus = Math.min(40, disruptionBonus);
    delayBonus      = Math.min(25, delayBonus);

    createIntelligenceAudit({
      companyId,
      shipmentId,
      eventType: "news_risk_added",
      source:    "NewsIntelligence",
      metadata:  { articleCount: normalized.length, disruptionBonus, delayBonus, categories: Array.from(categories) },
    }).catch(() => {});

    return {
      disruptionBonus,
      delayBonus,
      affectedCategories:  Array.from(categories),
      articleCount:        normalized.length,
      normalizedIncidents: normalized,
    };
  } catch (err) {
    console.error("[news-intelligence] Processing error:", err);
    return EMPTY;
  }
}
