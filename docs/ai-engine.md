# AI Intelligence Pipeline

SentinelRoute combines deterministic risk scoring with AI-generated reasoning. The two layers are kept strictly separate: the risk score is computed before Gemini is called, and Gemini's output never influences the score.

---

## Data Inputs

| Source | Role |
|---|---|
| OSRM | Road-network routing -distance, duration, and GeoJSON geometry |
| OpenWeather | Weather scoring at 5 evenly spaced points along the route geometry |
| Geoapify | Address autosuggest and coordinate resolution for origin/destination |
| Historical Corridor Data | Reliability, average delay, and incident density per corridor |
| Incidents Collection | Active incidents within affected radius of the route |
| Festival Data | Festival calendar seeded to MongoDB via `scripts/seed-festivals.ts` |

---

## Weather Sampling

The `WeatherSampler` (`src/lib/weather.ts`) selects exactly 5 evenly spaced indices from the OSRM route geometry's coordinate array and fetches OpenWeather current conditions for each in parallel via `Promise.all`.

Condition strings are mapped to numeric scores:

| Condition | Score |
|---|---|
| Clear | 0 |
| Clouds | 1 |
| Rain | 3 |
| Thunderstorm | 5 |
| Unknown | 1 |

The arithmetic mean of the 5 scores is the `weatherFactor`. Individual failures fall back to score 1 and never abort the overall computation.

---

## Risk Computation

The Risk Engine (`src/lib/risk.ts`) computes `riskScore` deterministically from five inputs:

```
riskScore = distanceFactor + durationFactor + weatherFactor + urgencyFactor + cargoFactor

distanceFactor  = distanceKm × 0.02
durationFactor  = durationHours × 0.5
urgencyFactor   = 5 (< 24 h to deadline)
                  3 (24–72 h to deadline)
                  1 (≥ 72 h to deadline)
cargoFactor     = 4 (fragile)
                  1 (standard)
```

**Risk level thresholds:**

| riskScore | riskLevel |
|---|---|
| 0 – 10 | Low |
| 10 – 20 | Medium |
| > 20 | High |

The Risk Engine is stateless. For any fixed input tuple, the output is always identical. This makes scores reproducible and auditable.

---

## Composite Route Scoring (Route Analysis)

During route analysis at `POST /api/analyze-routes`, the composite risk score uses a weighted multi-factor formula:

```
riskScore = (
  traffic    × 0.30 +
  weather    × 0.30 +
  disruption × 0.25 +
  cargo      × 0.15
) × urgencyMultiplier
```

| Factor | Source | Weight |
|---|---|---|
| Traffic congestion | OSRM duration vs static ETA | 30% |
| Weather severity | OpenWeather corridor sampling | 30% |
| Route disruption | Distance + delay ratio + warnings | 25% |
| Cargo sensitivity | Type-based lookup (Pharma, Cold Chain, Electronics) | 15% |
| Urgency multiplier | Standard 1.0× · Priority 1.2× · Critical 1.45× | Applied last |

**Output:** `low` · `medium` · `high` · `critical`

Each route also receives a SHA-256 integrity hash at analysis time -tamper-evident by design.

---

## Gemini Integration

After the risk score is computed, the API calls `generateExplanation()` in `src/lib/gemini.ts` exactly once per shipment, passing:
- `distanceKm`
- `durationHours`
- `weatherFactor`
- `riskScore`
- `riskLevel`
- `deadline`

The model generates a 2–3 sentence logistics risk summary.

**Retry behavior:**
- On HTTP 429 (rate limited): wait 30 seconds and retry exactly once.
- On double failure: set `aiExplanation` to `"AI explanation unavailable. Showing system-generated reasoning."` and continue shipment creation.
- Maximum two Gemini calls per shipment under any circumstances.
- Gemini failure never blocks shipment creation.

---

## Explainable AI in Recommendations

Every recommendation from the Recommendation Engine includes:
- `reason` -plain-language explanation of what triggered the recommendation
- `confidence` -numeric 0–100 score
- `affectedMetrics` -list of metrics impacted (e.g., `["ETA", "risk_score"]`)
- `tradeoffs` -list of known downsides or constraints
- `estimatedImpact` -description of the expected operational outcome

No recommendation is surfaced without a complete human-readable explanation. This is enforced at the type level -all fields are required on `OperationalRecommendation`.

---

## Route Confidence Scoring

Each route also receives a `confidenceScore` based on:
- `weatherConfidence` -inverse of weather severity along the corridor
- `incidentDensity` -active incidents within the route's affected radius
- `trafficStability` -ratio of OSRM estimated duration to historical average
- `historicalCorridorReliability` -percentage of past shipments that completed on time on this corridor

These sub-scores are combined into `overallOperationalConfidence` and stored on the `RoutePrediction` document.
