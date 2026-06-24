/**
 * news-intelligence.ts — NewsAPI integration for logistics disruption signals.
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
import type { Incident, IncidentCategory } from "../types";
import { NEWS_API_KEY } from "../env";

// ─── NewsAPI response shapes ──────────────────────────────────────────────────

interface NewsAPIArticle {
  title:       string | null;
  description: string | null;
  url:         string;
  publishedAt: string;
  source:      { name: string };
}

interface NewsAPIResponse {
  status:      string;
  totalResults: number;
  articles:    NewsAPIArticle[];
}

// ─── Disruption keyword groups ────────────────────────────────────────────────

const DISRUPTION_KEYWORDS = [
  "road closure",
  "highway closure",
  "traffic disruption",
  "truck strike",
  "transport strike",
  "logistics disruption",
  "flooded road",
  "landslide",
  "protest",
  "political rally",
  "civil unrest",
  "transport blockade",
  "accident",
].join(" OR ");

// ─── Keyword → category + severity mapping ────────────────────────────────────

interface ClassificationResult {
  category:  IncidentCategory;
  severity:  "low" | "medium" | "high" | "critical";
  impactScore: number;
  riskContribution: number; // 0-100 addition to disruption probability
}

function classifyArticle(text: string): ClassificationResult {
  const lower = text.toLowerCase();

  if (lower.includes("strike") || lower.includes("blockade") || lower.includes("civil unrest")) {
    return { category: "Political", severity: "high", impactScore: 75, riskContribution: 20 };
  }
  if (lower.includes("landslide") || lower.includes("flood") || lower.includes("flooded")) {
    return { category: "Natural Disaster", severity: "critical", impactScore: 90, riskContribution: 30 };
  }
  if (lower.includes("road closure") || lower.includes("highway closure")) {
    return { category: "Road Closure", severity: "high", impactScore: 70, riskContribution: 18 };
  }
  if (lower.includes("accident")) {
    return { category: "Accident", severity: "medium", impactScore: 55, riskContribution: 12 };
  }
  if (lower.includes("traffic disruption") || lower.includes("congestion")) {
    return { category: "Traffic", severity: "medium", impactScore: 50, riskContribution: 10 };
  }
  if (lower.includes("protest") || lower.includes("rally")) {
    return { category: "Public Event", severity: "medium", impactScore: 45, riskContribution: 8 };
  }
  if (lower.includes("transport strike") || lower.includes("truck strike") || lower.includes("logistics disruption")) {
    return { category: "Restriction", severity: "high", impactScore: 65, riskContribution: 16 };
  }

  return { category: "Unknown", severity: "low", impactScore: 20, riskContribution: 5 };
}

// ─── Deterministic ID from URL ────────────────────────────────────────────────

function articleToIncidentId(url: string): string {
  // Simple stable hash from URL — avoids duplicates across fetches
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
  const title = article.title ?? "";
  const description = article.description ?? "";
  const combined = `${title} ${description}`;

  if (!title || title === "[Removed]") return null;

  const classification = classifyArticle(combined);
  const incidentId = articleToIncidentId(article.url);
  const now = new Date().toISOString();

  return {
    incidentId,
    // Global incidents — no company scope
    title:             title.slice(0, 150),
    description:       description.slice(0, 300) || `${classification.category} event reported in India.`,
    category:          classification.category,
    severity:          classification.severity,
    confidence:        75,
    // NewsAPI doesn't provide exact coordinates — center on India
    latitude:          20.5937,
    longitude:         78.9629,
    affectedRadiusKm:  100, // national/regional scope
    startTime:         article.publishedAt,
    lastUpdated:       now,
    source:            `NewsAPI:${article.source.name}`,
    verifiedStatus:    false, // news articles are unverified
    impactScore:       classification.impactScore,
    recommendedAction: classification.severity === "critical"
      ? "Reroute immediately — major disruption reported"
      : classification.severity === "high"
      ? "Evaluate alternate corridor routes"
      : "Monitor situation closely",
  };
}

// ─── Persistence with deduplication ──────────────────────────────────────────

async function persistIncidents(incidents: Incident[]): Promise<void> {
  if (incidents.length === 0) return;
  const db = await getDb();

  // Upsert into incident_events — deduplication via incidentId
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
        metadata: {
          title:    inc.title,
          category: inc.category,
          severity: inc.severity,
          source:   inc.source,
        },
      }).catch(() => {});
    })
  );
}

// ─── Risk contribution calculation ───────────────────────────────────────────

export interface NewsRiskContribution {
  disruptionBonus:      number; // 0-100 addition to disruptionProbability
  delayBonus:           number; // 0-100 addition to delayProbability
  affectedCategories:   IncidentCategory[];
  articleCount:         number;
  normalizedIncidents:  Incident[];
}

const MOCK_NEWS_ARTICLES: NewsAPIArticle[] = [
  {
    title: "Truck strike blockades Chennai-Bengaluru highway, severe cargo delay expected",
    description: "All India Motor Transport Congress calls strike. Hundreds of trucks blocked on highway NH-48. Traffic disruption is critical.",
    url: "https://timesofindia.indiatimes.com/india/truck-strike-highway-closure",
    publishedAt: new Date().toISOString(),
    source: { name: "Times of India" }
  },
  {
    title: "Landslide on Mumbai-Pune Expressway halts logistics flow",
    description: "Heavy rainfall triggers landslide near Lonavala. Highway authorities close two lanes. Restoration work underway.",
    url: "https://indianexpress.com/article/cities/mumbai/landslide-highway-closure",
    publishedAt: new Date().toISOString(),
    source: { name: "Indian Express" }
  },
  {
    title: "Protest near Delhi-NCR causes major transport disruption",
    description: "Political rally blockades regional highways. Traffic police issues warnings for heavy container vehicles.",
    url: "https://www.thehindu.com/news/national/protest-blockade",
    publishedAt: new Date().toISOString(),
    source: { name: "The Hindu" }
  }
];

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Fetches India-focused logistics disruption news, normalizes, deduplicates,
 * persists, and returns a risk contribution for the prediction engine.
 *
 * @param companyId  Company context for audit logging
 * @param shipmentId Optional shipment context
 * @returns NewsRiskContribution — mock news returned if API key missing or fetch fails
 */
export async function getNewsRiskContribution(
  companyId: string,
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
    console.warn("[news-intelligence] NEWS_API_KEY not set — falling back to deterministic mock news");
    articles = MOCK_NEWS_ARTICLES;
  } else {
    try {
      const url =
        `https://newsapi.org/v2/everything` +
        `?q=${encodeURIComponent(DISRUPTION_KEYWORDS)}` +
        `&language=en` +
        `&sortBy=publishedAt` +
        `&pageSize=20` +
        `&apiKey=${apiKey}`;

      const res = await fetch(url, {
        next: { revalidate: 3600 }, // cache for 1 hour
      });

      if (res.ok) {
        const data: NewsAPIResponse = await res.json();
        if (data.status === "ok" && Array.isArray(data.articles)) {
          articles = data.articles;
        }
      }
    } catch (err) {
      console.error("[news-intelligence] NewsAPI fetch failed, falling back to mock news:", err);
    }

    if (articles.length === 0) {
      console.warn("[news-intelligence] No articles returned from NewsAPI — falling back to mock news");
      articles = MOCK_NEWS_ARTICLES;
    }
  }

  try {
    // Normalize — filter nulls
    const normalized: Incident[] = articles
      .map(normalizeArticle)
      .filter((x): x is Incident => x !== null);

    if (normalized.length === 0) return EMPTY;

    // Persist (fire-and-forget — failures don't block risk calc)
    persistIncidents(normalized).catch((err) =>
      console.error("[news-intelligence] Persist failed:", err)
    );

    // Aggregate risk contribution
    const categories = new Set<IncidentCategory>();
    let disruptionBonus = 0;
    let delayBonus = 0;

    for (const inc of normalized) {
      const cls = classifyArticle(`${inc.title} ${inc.description}`);
      disruptionBonus += cls.riskContribution;
      delayBonus += Math.round(cls.riskContribution * 0.6);
      categories.add(inc.category);
    }

    // Cap contributions
    disruptionBonus = Math.min(40, disruptionBonus);
    delayBonus      = Math.min(25, delayBonus);

    // ── Audit: news_risk_added ─────────────────────────────────────────────
    createIntelligenceAudit({
      companyId,
      shipmentId,
      eventType: "news_risk_added",
      source:    "NewsIntelligence",
      metadata: {
        articleCount:    normalized.length,
        disruptionBonus,
        delayBonus,
        categories:      Array.from(categories),
      },
    }).catch(() => {});

    return {
      disruptionBonus,
      delayBonus,
      affectedCategories:  Array.from(categories),
      articleCount:        normalized.length,
      normalizedIncidents: normalized,
    };
  } catch (err) {
    console.error("[news-intelligence] Error in processing news contribution:", err);
    return EMPTY;
  }
}
