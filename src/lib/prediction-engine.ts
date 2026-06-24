import { getDb } from "./mongodb";
import { RoutePrediction, Shipment } from "./types";
import { getActiveIncidents } from "./intelligence-service";
import { createIntelligenceAudit } from "./intelligence-audit";
import { getNewsRiskContribution } from "./intelligence/news-intelligence";
import { getFestivalRiskContribution } from "./intelligence/festival-intelligence";

/**
 * Calculates deterministic probabilities and confidence for a shipment.
 * Incorporates: incidents, news intelligence, and festival calendar.
 * No AI hallucination — strict formulas only.
 */
export async function calculateRoutePrediction(shipment: Shipment): Promise<RoutePrediction> {
  const companyId = shipment.companyId || "system";

  // ── Gather all intelligence sources in parallel ────────────────────────────
  const [incidents, newsContrib, festivalContrib] = await Promise.all([
    getActiveIncidents(companyId),
    getNewsRiskContribution(companyId, shipment.id),
    getFestivalRiskContribution(companyId, shipment.id),
  ]);

  let trafficStability      = 90;
  let weatherConfidence     = 85;
  let incidentDensity       = 10;
  let delayProbability      = 5;
  let disruptionProbability = 2;

  const contributingFactors: string[] = ["Historical baseline route reliability"];
  const sourceApis: string[]          = ["SentinelRoute Risk Baseline"];

  // ── Incident analysis ──────────────────────────────────────────────────────
  const criticalIncidents = incidents.filter(i => i.severity === "critical");
  const highIncidents     = incidents.filter(i => i.severity === "high");

  if (criticalIncidents.length > 0) {
    delayProbability      += 40;
    disruptionProbability += 20;
    trafficStability      -= 30;
    incidentDensity       += 40;
    contributingFactors.push("Critical incidents detected near route");
    sourceApis.push("NHAI Feed");
  } else if (highIncidents.length > 0) {
    delayProbability      += 20;
    disruptionProbability += 5;
    trafficStability      -= 15;
    incidentDensity       += 20;
    contributingFactors.push("High severity incidents detected near route");
    sourceApis.push("NHAI Feed");
  }

  // ── Weather assessment ─────────────────────────────────────────────────────
  const weatherIncidents = incidents.filter(i => i.category === "Weather");
  if (weatherIncidents.length > 0) {
    weatherConfidence -= 30;
    delayProbability  += 15;
    contributingFactors.push("Adverse weather conditions reported");
    sourceApis.push("OpenWeather API");
  }

  // ── News intelligence contribution ────────────────────────────────────────
  if (newsContrib.articleCount > 0) {
    disruptionProbability += newsContrib.disruptionBonus;
    delayProbability      += newsContrib.delayBonus;
    contributingFactors.push(
      `${newsContrib.articleCount} disruption news article${newsContrib.articleCount !== 1 ? "s" : ""} detected`
    );
    sourceApis.push("NewsAPI");
  }

  // ── Festival intelligence contribution ────────────────────────────────────
  if (festivalContrib.activeFestivals.length > 0) {
    delayProbability      += festivalContrib.festivalBonus;
    disruptionProbability += Math.round(festivalContrib.festivalBonus * 0.5);
    trafficStability      -= Math.round(festivalContrib.congestionScore * 0.3);
    const festNames = festivalContrib.activeFestivals.map(f => f.name).join(", ");
    contributingFactors.push(`Festival congestion: ${festNames}`);
    sourceApis.push("Festival Calendar");
  }

  // ── Cap all values ─────────────────────────────────────────────────────────
  delayProbability      = Math.min(100, Math.max(0, delayProbability));
  disruptionProbability = Math.min(100, Math.max(0, disruptionProbability));
  trafficStability      = Math.min(100, Math.max(0, trafficStability));
  weatherConfidence     = Math.min(100, Math.max(0, weatherConfidence));
  incidentDensity       = Math.min(100, Math.max(0, incidentDensity));

  const etaConfidence              = 100 - delayProbability;
  const corridorVolatility         = Math.min(100, (100 - trafficStability) + incidentDensity);
  const overallOperationalConfidence = Math.round(
    (etaConfidence + trafficStability + weatherConfidence) / 3
  );

  const predictionId = `pred-${shipment.id}-${Date.now()}`;

  const prediction: RoutePrediction = {
    predictionId,
    shipmentId:    shipment.id,
    companyId,
    timestamp:     new Date().toISOString(),
    createdAt:     new Date().toISOString(),
    delayProbability,
    disruptionProbability,
    etaConfidence,
    corridorVolatility,
    weatherConfidence,
    incidentDensity,
    trafficStability,
    historicalCorridorReliability: 88,
    riskTrend: overallOperationalConfidence > 70 ? "stable" : "degrading",
    expectedDelayMinutes:          delayProbability > 30 ? Math.round(delayProbability * 0.5) : 0,
    recommendedRouteConfidence:    etaConfidence > 50 ? etaConfidence : 50,
    overallOperationalConfidence,
    reason: overallOperationalConfidence > 80
      ? "Optimal conditions"
      : overallOperationalConfidence > 50
      ? "Minor disruptions detected"
      : "High risk of delay or disruption",
    contributingFactors,
    sourceApis,
  };

  const db = await getDb();
  await db.collection("route_predictions").insertOne(prediction);

  // Store risk calculation outputs
  const riskCalc = {
    calculationId: `rc-${prediction.predictionId}`,
    companyId,
    shipmentId:    shipment.id,
    createdAt:     prediction.timestamp,
    overallRiskScore: 100 - prediction.overallOperationalConfidence,
    delayProbability: prediction.delayProbability,
    disruptionProbability: prediction.disruptionProbability,
    weatherRisk:   prediction.weatherConfidence !== undefined ? 100 - prediction.weatherConfidence : 0,
    trafficRisk:   prediction.trafficStability !== undefined ? 100 - prediction.trafficStability : 0,
    festivalRiskScore: festivalContrib.festivalBonus,
    festivalCongestionScore: festivalContrib.congestionScore,
    festivalCongestionMultiplier: festivalContrib.activeFestivals.length > 0 
      ? Math.max(...festivalContrib.activeFestivals.map(f => f.congestionMultiplier)) 
      : 1.0,
    newsDisruptionBonus: newsContrib.disruptionBonus,
    newsDelayBonus: newsContrib.delayBonus,
    metadata: {
      contributingFactors: prediction.contributingFactors,
      activeFestivals: festivalContrib.activeFestivals.map(f => ({ id: f.id, name: f.name })),
      newsArticleCount: newsContrib.articleCount,
    }
  };
  await db.collection("risk_calculations").insertOne(riskCalc).catch(err => {
    console.error("[PredictionEngine] Failed to save risk calculation:", err);
  });

  // ── Risk delta audit: risk_calculated / risk_increased / risk_decreased ───
  // Compare new risk score against the most recent prior calculation for this
  // shipment. Fire-and-forget — never blocks the prediction result.
  (async () => {
    try {
      const currentRiskScore = riskCalc.overallRiskScore;

      // Fetch previous calculation (sorted by createdAt desc, skip the one we just inserted)
      const previousCalc = await db
        .collection("risk_calculations")
        .find({ companyId, shipmentId: shipment.id })
        .sort({ createdAt: -1 })
        .skip(1)   // skip the record we just inserted
        .limit(1)
        .toArray();

      const riskDeltaMetadata = {
        predictionId,
        currentRiskScore,
        delayProbability,
        disruptionProbability,
        overallOperationalConfidence,
        contributingFactors,
      };

      if (previousCalc.length === 0) {
        // First calculation for this shipment
        await createIntelligenceAudit({
          companyId,
          shipmentId: shipment.id,
          eventType:  "risk_calculated",
          source:     "PredictionEngine",
          metadata:   { ...riskDeltaMetadata, isFirstCalculation: true },
        });
      } else {
        const prevScore = previousCalc[0].overallRiskScore as number;
        const delta     = currentRiskScore - prevScore;

        if (Math.abs(delta) < 3) {
          // Negligible change — still record it as a baseline recalculation
          await createIntelligenceAudit({
            companyId,
            shipmentId: shipment.id,
            eventType:  "risk_calculated",
            source:     "PredictionEngine",
            metadata:   { ...riskDeltaMetadata, previousRiskScore: prevScore, delta, change: "stable" },
          });
        } else if (delta > 0) {
          await createIntelligenceAudit({
            companyId,
            shipmentId: shipment.id,
            eventType:  "risk_increased",
            source:     "PredictionEngine",
            metadata:   { ...riskDeltaMetadata, previousRiskScore: prevScore, delta, change: "increased" },
          });
        } else {
          await createIntelligenceAudit({
            companyId,
            shipmentId: shipment.id,
            eventType:  "risk_decreased",
            source:     "PredictionEngine",
            metadata:   { ...riskDeltaMetadata, previousRiskScore: prevScore, delta, change: "decreased" },
          });
        }
      }
    } catch (auditErr) {
      console.error("[PredictionEngine] Risk delta audit failed:", auditErr);
    }
  })();

  // ── Audit events (fire-and-forget) ────────────────────────────────────────

  createIntelligenceAudit({
    companyId,
    shipmentId: shipment.id,
    eventType:  "delay_prediction_generated",
    source:     "PredictionEngine",
    metadata: {
      predictionId,
      delayProbability,
      disruptionProbability,
      etaConfidence,
      corridorVolatility,
      overallOperationalConfidence,
      contributingFactors,
    },
  }).catch(() => {});

  if (disruptionProbability > 30) {
    createIntelligenceAudit({
      companyId,
      shipmentId: shipment.id,
      eventType:  "disruption_prediction_generated",
      source:     "PredictionEngine",
      metadata:   { predictionId, disruptionProbability, reason: prediction.reason },
    }).catch(() => {});
  }

  createIntelligenceAudit({
    companyId,
    shipmentId: shipment.id,
    eventType:  "eta_confidence_updated",
    source:     "PredictionEngine",
    metadata:   { predictionId, etaConfidence, expectedDelayMinutes: prediction.expectedDelayMinutes },
  }).catch(() => {});

  createIntelligenceAudit({
    companyId,
    shipmentId: shipment.id,
    eventType:  "corridor_volatility_updated",
    source:     "PredictionEngine",
    metadata:   { predictionId, corridorVolatility, trafficStability, incidentDensity },
  }).catch(() => {});

  if (weatherIncidents.length > 0) {
    createIntelligenceAudit({
      companyId,
      shipmentId: shipment.id,
      eventType:  "weather_risk_added",
      source:     "PredictionEngine",
      metadata: {
        predictionId,
        weatherConfidence,
        weatherIncidentsCount: weatherIncidents.length,
      },
    }).catch(() => {});
  }

  if (criticalIncidents.length > 0 || highIncidents.length > 0) {
    createIntelligenceAudit({
      companyId,
      shipmentId: shipment.id,
      eventType:  "traffic_risk_added",
      source:     "PredictionEngine",
      metadata: {
        predictionId,
        trafficStability,
        incidentDensity,
        criticalCount: criticalIncidents.length,
        highCount: highIncidents.length,
      },
    }).catch(() => {});
  }

  if (overallOperationalConfidence < 50) {
    createIntelligenceAudit({
      companyId,
      shipmentId: shipment.id,
      eventType:  "reroute_suggested",
      source:     "PredictionEngine",
      metadata: {
        predictionId,
        overallOperationalConfidence,
        suggestedRoute: "safest",
      },
    }).catch(() => {});
  }

  return prediction;
}

export async function getShipmentPredictions(shipmentId: string): Promise<RoutePrediction[]> {
  const db = await getDb();
  const predictions = await db.collection("route_predictions")
    .find({ shipmentId })
    .sort({ timestamp: -1 })
    .toArray();

  return predictions.map(doc => {
    const { _id, ...rest } = doc;
    return rest as unknown as RoutePrediction;
  });
}
