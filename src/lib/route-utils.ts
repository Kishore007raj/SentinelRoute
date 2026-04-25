/**
 * route-utils.ts — Shared decision intelligence utilities.
 *
 * Single source of truth for confidence scoring, spread analysis,
 * and recommendation logic. Imported by routes/page.tsx, ShipmentPass.tsx,
 * and AiInsightBox.tsx.
 *
 * Defensive guarantees:
 *   - All numeric computations guard against NaN / non-finite values.
 *   - All comparisons use etaMinutes (number), never eta strings.
 *   - Tradeoff logic: fastest↔safest, safest↔fastest, balanced↔both.
 *   - Spread thresholds: < 10 (identical), < 18 (close), ≥ 18 (meaningful).
 */

import type { Route } from "./types";

// ─── Internal numeric guard ───────────────────────────────────────────────────

/** Returns `fallback` if `value` is not a finite number. */
function safeNum(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

// ─── Spread helpers ───────────────────────────────────────────────────────────

export function routeSpread(routes: Route[]): number {
  if (routes.length < 2) return 0;
  const scores = routes.map((r) => safeNum(r.riskScore));
  return Math.max(...scores) - Math.min(...scores);
}

export function isSimilarRoutes(routes: Route[]): boolean {
  return routeSpread(routes) < 10;
}

// ─── Confidence engine ────────────────────────────────────────────────────────

/**
 * Derives a confidence percentage (30–98) from real route data.
 *
 * Factors (in order of weight):
 *   - Weather severity        → penalty up to 25 pts
 *   - Traffic congestion      → penalty up to 20 pts
 *   - Disruption level        → penalty up to 15 pts
 *   - Risk spread (close = uncertain, clear winner = bonus)
 *   - Data source quality     → ±5–8 pts
 *
 * All intermediate values are guarded against NaN.
 */
export function deriveConfidence(
  route: Route,
  allRoutes: Route[],
  dataSource?: string
): number {
  const { riskBreakdown } = route;

  // Guard each breakdown value — malformed API data must not produce NaN
  const weather    = safeNum(riskBreakdown.weather);
  const traffic    = safeNum(riskBreakdown.traffic);
  const disruption = safeNum(riskBreakdown.disruption);

  const weatherPenalty    = Math.round(weather    * 0.25);
  const trafficPenalty    = Math.round(traffic    * 0.20);
  const disruptionPenalty = Math.round(disruption * 0.15);
  const sourceBonus       = dataSource === "osrm+openweather" ? 5 : -8;

  let spreadPenalty    = 0;
  let clearWinnerBonus = 0;

  if (allRoutes.length >= 2) {
    const spread = routeSpread(allRoutes);
    if (spread < 10)       spreadPenalty = 12;
    else if (spread < 20)  spreadPenalty = 6;

    const thisScore = safeNum(route.riskScore);
    const others    = allRoutes
      .filter((r) => r.id !== route.id)
      .map((r) => safeNum(r.riskScore));
    if (others.length > 0) {
      const nextBest = Math.min(...others);
      if (thisScore < nextBest - 25) clearWinnerBonus = 8;
    }
  }

  const raw = 100 - weatherPenalty - trafficPenalty - disruptionPenalty
                  - spreadPenalty + sourceBonus + clearWinnerBonus;

  // Final guard: if somehow raw is still NaN, return a safe default
  return Math.max(30, Math.min(98, Number.isFinite(raw) ? raw : 50));
}

export function confidenceLabel(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: "High Confidence",   color: "text-emerald-400" };
  if (pct >= 65) return { label: "Medium Confidence", color: "text-amber-400"   };
  return              { label: "Low Confidence",    color: "text-red-400"     };
}

/**
 * Returns up to 3 human-readable reasons that explain the confidence score.
 * Includes volatility awareness (weather severity, traffic variability)
 * and spread awareness (closely matched routes).
 */
export function confidenceReasons(
  route: Route,
  allRoutes: Route[],
  dataSource?: string
): string[] {
  const reasons: string[] = [];
  const weather    = safeNum(route.riskBreakdown.weather);
  const traffic    = safeNum(route.riskBreakdown.traffic);
  const disruption = safeNum(route.riskBreakdown.disruption);
  const { label }  = route;

  // Weather — severity-aware language
  if (weather > 70)
    reasons.push("Severe weather — ETA variance is high");
  else if (weather > 50)
    reasons.push("Adverse weather reduces ETA predictability");
  else if (weather < 20)
    reasons.push("Clear weather — high ETA accuracy");

  // Traffic — variability-aware language
  if (traffic > 70)
    reasons.push("Heavy, unpredictable traffic — arrival time unreliable");
  else if (traffic > 60)
    reasons.push("Heavy traffic increases arrival variance");
  else if (traffic < 25)
    reasons.push("Low traffic — minimal delay variance");

  // Route label context
  if (label === "safest")
    reasons.push("Safest route has lowest delay variance");
  else if (label === "fastest")
    reasons.push("Fastest route has higher congestion exposure");

  // Disruption
  if (disruption > 60)
    reasons.push("Active disruptions detected on corridor");
  else if (disruption > 50)
    reasons.push("Disruption risk elevated on this corridor");

  // Spread awareness — exact spec wording
  if (allRoutes.length >= 2) {
    const spread = routeSpread(allRoutes);
    if (spread < 10)
      reasons.push("Routes are nearly identical — decision sensitivity is high");
    else if (spread < 18)
      reasons.push("Routes are closely matched — difference is small");
  }

  // Data source
  if (dataSource === "static-fallback")
    reasons.push("Estimated data — live routing unavailable");

  return reasons.slice(0, 3);
}

// ─── Recommendation badge ─────────────────────────────────────────────────────

export function recommendationBadge(
  route: Route,
  cargoType: string,
  urgency: string,
  allRoutes: Route[]
): string {
  if (urgency === "Critical") return "Fastest";
  if (cargoType === "Pharmaceuticals" || cargoType === "Cold Chain Goods") return "Safest";
  if (allRoutes.length >= 2) {
    const spread = routeSpread(allRoutes);
    if (spread < 15 && route.label === "balanced") return "Best Efficiency Choice";
  }
  if (route.label === "balanced") return "Best Overall";
  if (route.label === "fastest")  return "Fastest";
  if (route.label === "safest")   return "Safest";
  return "Recommended";
}

// ─── Decision verdict ─────────────────────────────────────────────────────────

export function decisionVerdict(
  route: Route,
  cargoType?: string,
  urgency?: string,
  allRoutes?: Route[]
): string {
  const { label, riskLevel } = route;
  const riskScore = safeNum(route.riskScore);

  if (allRoutes && allRoutes.length >= 2) {
    const spread = routeSpread(allRoutes);
    if (spread < 10)
      return `All routes perform similarly — choice based on ${
        label === "fastest" ? "speed" : label === "safest" ? "safety" : "efficiency"
      } preference.`;
  }

  if (urgency === "Critical")
    return `Critical urgency — fastest path selected. Risk ${riskScore}/100 accepted for speed.`;
  if (cargoType === "Pharmaceuticals" || cargoType === "Cold Chain Goods")
    return `Sensitive cargo — lowest-disruption corridor selected. Risk ${riskScore}/100 (${riskLevel}).`;
  if (label === "balanced")
    return `Optimal tradeoff selected — ${riskLevel} risk (${riskScore}/100) with acceptable ETA.`;
  if (label === "safest")
    return `Lowest-risk corridor — ${riskScore}/100. Longer transit accepted for reduced exposure.`;
  if (label === "fastest")
    return `Fastest path — ${riskScore}/100 risk accepted. Monitor corridor conditions post-dispatch.`;
  return `Route confirmed — ${riskLevel} risk (${riskScore}/100).`;
}

// ─── Selection feedback ───────────────────────────────────────────────────────

export function selectionFeedback(
  route: Route,
  cargoType?: string,
  urgency?: string,
  allRoutes?: Route[]
): string {
  const { label, riskBreakdown } = route;
  const riskScore   = safeNum(route.riskScore);
  const etaMinutes  = safeNum(route.etaMinutes);
  const dominant    = Object.entries(riskBreakdown).sort(([, a], [, b]) => b - a)[0];

  // Spread note: compare against the semantically meaningful opposite
  let spreadNote = "";
  if (allRoutes && allRoutes.length >= 2) {
    if (label === "fastest") {
      const safest = allRoutes.find((r) => r.label === "safest");
      if (safest) {
        const riskCost  = riskScore - safeNum(safest.riskScore);
        const timeSaved = safeNum(safest.etaMinutes) - etaMinutes;
        if (Number.isFinite(riskCost) && riskCost > 0 && Number.isFinite(timeSaved) && timeSaved > 0)
          spreadNote = ` ${riskCost} points higher risk than safest, saving ${timeSaved} min.`;
        else if (Number.isFinite(riskCost) && riskCost > 0)
          spreadNote = ` ${riskCost} points higher risk than the safest option.`;
      }
    } else if (label === "safest") {
      const fastest = allRoutes.find((r) => r.label === "fastest");
      if (fastest) {
        const riskSaved = safeNum(fastest.riskScore) - riskScore;
        const timeCost  = etaMinutes - safeNum(fastest.etaMinutes);
        if (Number.isFinite(riskSaved) && riskSaved > 0 && Number.isFinite(timeCost) && timeCost > 0)
          spreadNote = ` ${riskSaved} points lower risk than fastest, adding ${timeCost} min.`;
        else if (Number.isFinite(riskSaved) && riskSaved > 0)
          spreadNote = ` ${riskSaved} points lower risk than the fastest option.`;
      }
    } else {
      // Balanced: compare against the next-best alternative
      const others    = allRoutes.filter((r) => r.id !== route.id);
      const bestOther = others.reduce((a, b) =>
        safeNum(a.riskScore) < safeNum(b.riskScore) ? a : b
      );
      const diff = safeNum(bestOther.riskScore) - riskScore;
      if (Number.isFinite(diff)) {
        if (diff > 20)     spreadNote = ` ${diff} points safer than the next option.`;
        else if (diff > 5) spreadNote = ` Marginally lower risk than alternatives.`;
      }
    }
  }

  if (label === "fastest" && urgency === "Critical")
    return `Critical urgency confirmed. Fastest path selected — arrival time prioritised over risk exposure.${spreadNote}`;
  if ((cargoType === "Pharmaceuticals" || cargoType === "Cold Chain Goods") && label === "safest")
    return `Temperature-sensitive cargo routed via lowest-disruption corridor. Delay variance minimised.${spreadNote}`;
  if (label === "balanced")
    return `Balanced selection. ${
      dominant[0] === "traffic" ? "Traffic" :
      dominant[0] === "weather" ? "Weather" : "Disruption"
    } is the primary variable at ${safeNum(dominant[1] as number)}/100.${spreadNote}`;
  if (label === "safest")
    return `Safest corridor selected. Risk score ${riskScore}/100 — lowest exposure on this route set.${spreadNote}`;
  if (label === "fastest")
    return `Fastest path selected. Accepts higher risk (${riskScore}/100) in exchange for reduced transit time.${spreadNote}`;
  return `Route confirmed. Risk score ${riskScore}/100.${spreadNote}`;
}

// ─── Live insight hint ────────────────────────────────────────────────────────

export function liveInsightHint(
  route: Route,
  allRoutes: Route[],
  dataSource?: string
): string | null {
  const weather  = safeNum(route.riskBreakdown.weather);
  const traffic  = safeNum(route.riskBreakdown.traffic);
  const riskScore = safeNum(route.riskScore);

  // Exact spec wording — no variations
  if (weather > 60)
    return "Weather is the primary risk driver on this route — conditions are actively affecting the corridor.";
  if (traffic > 70)
    return "Traffic conditions significantly impact route performance — all options carry elevated delay risk.";

  if (allRoutes.length >= 2) {
    const spread = routeSpread(allRoutes);
    if (spread > 40)
      return "Strong risk differentiation across routes — the safest option is significantly lower risk than the fastest.";
    if (spread < 10)
      return "Routes are closely matched — the decision is primarily about ETA preference.";
  }

  if (dataSource === "static-fallback")
    return "Live routing data unavailable — scores are estimated. Treat ETA as approximate.";
  if (riskScore < 20)
    return "Unusually low risk across this corridor — conditions are favourable for dispatch.";

  return null;
}

// ─── Decision context (cards view panel) ─────────────────────────────────────

export function decisionContextText(routes: Route[]): string {
  if (!routes.length)
    return "Fastest route is not always the best. Balanced routes reduce disruption risk without major ETA loss.";

  const spread     = routeSpread(routes);
  const maxWeather = Math.max(...routes.map((r) => safeNum(r.riskBreakdown.weather)));
  const maxTraffic = Math.max(...routes.map((r) => safeNum(r.riskBreakdown.traffic)));

  // Exact spec wording for each case
  if (spread < 10)
    return "All routes perform similarly — differences are within margin of error. Choose based on ETA preference.";
  if (spread < 18)
    return "Routes are closely matched — choose based on ETA preference. Risk exposure is comparable across all options.";
  if (maxWeather > 60)
    return "Weather is the primary risk driver on this route. All corridors are affected — the safest option minimises exposure time.";
  if (maxTraffic > 70)
    return "Traffic conditions significantly impact route performance. The balanced route avoids the worst congestion without a major ETA penalty.";
  if (spread > 40)
    return `Strong risk differentiation — ${spread} points between fastest and safest. The choice here has real operational consequence.`;

  return "Balanced routes reduce disruption risk without major ETA loss. Fastest is not always the best choice.";
}

// ─── Tradeoff sentences for AiInsightBox ─────────────────────────────────────

/**
 * Builds the tradeoff sentence for the fallback explanation.
 * Semantically correct comparisons:
 *   fastest  → compare against safest  (risk cost of speed)
 *   safest   → compare against fastest (risk saving + time cost)
 *   balanced → compare against both extremes
 *
 * All numeric deltas are guarded against NaN.
 */
export function buildTradeoffSentence(
  route: Route,
  allRoutes: Route[]
): string {
  const { label } = route;
  const riskScore  = safeNum(route.riskScore);
  const etaMinutes = safeNum(route.etaMinutes);

  if (allRoutes.length < 2) {
    const labelDesc =
      label === "fastest"  ? "the fastest available path" :
      label === "balanced" ? "a balanced tradeoff between speed and risk" :
      "the lowest-risk corridor";
    return ` This route represents ${labelDesc}.`;
  }

  const fastest = allRoutes.find((r) => r.label === "fastest");
  const safest  = allRoutes.find((r) => r.label === "safest");

  if (label === "fastest" && safest) {
    const riskCost  = riskScore - safeNum(safest.riskScore);
    const timeSaved = safeNum(safest.etaMinutes) - etaMinutes;
    if (Number.isFinite(riskCost) && riskCost > 0 && Number.isFinite(timeSaved) && timeSaved > 0)
      return ` ${riskCost} points higher risk than the safest option, saving ${timeSaved} minutes.`;
    if (Number.isFinite(riskCost) && riskCost > 0)
      return ` Accepts ${riskCost} additional risk points vs the safest corridor.`;
    return ` Fastest path with comparable risk to alternatives.`;
  }

  if (label === "safest" && fastest) {
    const riskSaved = safeNum(fastest.riskScore) - riskScore;
    const timeCost  = etaMinutes - safeNum(fastest.etaMinutes);
    if (Number.isFinite(riskSaved) && riskSaved > 0 && Number.isFinite(timeCost) && timeCost > 0)
      return ` ${riskSaved} points lower risk than the fastest option, adding ${timeCost} minutes.`;
    if (Number.isFinite(riskSaved) && riskSaved > 0)
      return ` ${riskSaved} points lower risk than the fastest corridor.`;
    return ` Safest available path on this route set.`;
  }

  if (label === "balanced" && fastest && safest) {
    return ` Sits between fastest (risk ${safeNum(fastest.riskScore)}) and safest (risk ${safeNum(safest.riskScore)}) — optimised for the lowest delay-to-risk ratio.`;
  }

  return ` This route represents a ${label} option on this corridor.`;
}
