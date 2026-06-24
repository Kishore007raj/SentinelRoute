/**
 * weather.ts — OpenWeather API client for SentinelRoute.
 *
 * Provides:
 *   1. Current weather for a corridor (origin + destination)
 *   2. 5-day / 3-hour forecast for a coordinate pair
 *   3. Weather intelligence (rain probability, storm risk, visibility risk, temp anomaly)
 *   4. Snapshot persistence to weather_snapshots collection
 *
 * Strategy:
 *   - Sample weather at both origin and destination using coordinates
 *   - Take the worse of the two (most conservative risk estimate)
 *   - Convert weather conditions to a risk score
 *   - No hardcoded city tables — all lookups use lat/lng
 *
 * API: OpenWeather Current Weather Data + 5 Day Forecast
 * Docs: https://openweathermap.org/current
 *       https://openweathermap.org/forecast5
 *
 * Server-side only — uses OPENWEATHER_API_KEY from env.ts (no NEXT_PUBLIC_ prefix).
 */

import { OPENWEATHER_API_KEY } from "./env";

// ─── OpenWeather API response types (subset) ──────────────────────────────────

interface OWWeatherCondition {
  id: number;       // condition code: https://openweathermap.org/weather-conditions
  main: string;     // e.g. "Rain", "Thunderstorm", "Clear"
  description: string;
}

interface OWMain {
  temp: number;       // Celsius (units=metric)
  feels_like: number;
  humidity: number;   // %
  temp_min?: number;
  temp_max?: number;
}

interface OWWind {
  speed: number;  // m/s
  gust?: number;
}

interface OWRain {
  "1h"?: number;  // mm in last hour
  "3h"?: number;
}

interface OWSnow {
  "1h"?: number;
  "3h"?: number;
}

export interface OWCurrentWeather {
  weather: OWWeatherCondition[];
  main: OWMain;
  wind: OWWind;
  rain?: OWRain;
  snow?: OWSnow;
  visibility?: number;  // metres
  dt: number;           // Unix timestamp
  name: string;         // city name
  coord?: { lat: number; lon: number };
}

// ─── Forecast types ───────────────────────────────────────────────────────────

export interface OWForecastItem {
  dt: number;
  main: OWMain;
  weather: OWWeatherCondition[];
  wind: OWWind;
  rain?: { "3h"?: number };
  snow?: { "3h"?: number };
  visibility?: number;
  pop: number;          // probability of precipitation 0–1
  dt_txt: string;
}

export interface OWForecastResponse {
  list: OWForecastItem[];
  city: { name: string; country: string };
}

// ─── Weather Intelligence output ──────────────────────────────────────────────

export interface WeatherIntelligence {
  /** 0–100: probability of rain in next 24 hours */
  rainProbability:    number;
  /** 0–100: storm risk score */
  stormRisk:         number;
  /** 0–100: visibility impairment score */
  visibilityRisk:    number;
  /** Temperature deviation from seasonal norm (°C) */
  temperatureAnomaly: number;
  /** Composite weather risk score 0–100 */
  overallRisk:       number;
  /** Human-readable alert if conditions are adverse */
  weatherAlert:      string | null;
  /** Raw current weather */
  current:           OWCurrentWeather | null;
}

// ─── Weather risk scoring ─────────────────────────────────────────────────────

/**
 * Converts OpenWeather condition code + wind/rain data into a risk score 0–100.
 *
 * Condition code ranges:
 *   2xx = Thunderstorm
 *   3xx = Drizzle
 *   5xx = Rain
 *   6xx = Snow
 *   7xx = Atmosphere (fog, haze, dust, tornado)
 *   800 = Clear
 *   80x = Clouds
 */
function conditionCodeToRisk(code: number): number {
  if (code >= 200 && code < 300) return 85; // Thunderstorm
  if (code >= 300 && code < 400) return 30; // Drizzle
  if (code >= 500 && code < 510) return 55; // Rain
  if (code === 511)               return 70; // Freezing rain
  if (code >= 511 && code < 600) return 50; // Heavy rain
  if (code >= 600 && code < 700) return 65; // Snow
  if (code === 701)               return 40; // Mist
  if (code === 711)               return 35; // Smoke
  if (code === 721)               return 30; // Haze
  if (code === 731 || code === 761) return 45; // Dust/sand
  if (code === 741)               return 55; // Fog
  if (code === 751)               return 50; // Sand
  if (code === 762)               return 60; // Volcanic ash
  if (code === 771)               return 70; // Squalls
  if (code === 781)               return 95; // Tornado
  if (code === 800)               return 5;  // Clear
  if (code >= 801 && code <= 804) return 10; // Clouds
  return 20; // Unknown — neutral
}

function windRiskBonus(windSpeedMs: number, gustMs?: number): number {
  const effective = Math.max(windSpeedMs, gustMs ?? 0);
  if (effective > 20)  return 25; // storm-force
  if (effective > 14)  return 15; // strong wind
  if (effective > 8)   return 8;  // moderate wind
  return 0;
}

function rainRiskBonus(rain?: OWRain | { "3h"?: number }): number {
  const mm = (rain as OWRain | undefined)?.["1h"] ?? rain?.["3h"] ?? 0;
  if (mm > 20) return 20; // heavy rain
  if (mm > 7)  return 12; // moderate rain
  if (mm > 2)  return 6;  // light rain
  return 0;
}

function visibilityRiskBonus(visibility?: number): number {
  if (visibility === undefined) return 0;
  if (visibility < 200)  return 30; // very poor
  if (visibility < 1000) return 20; // poor
  if (visibility < 3000) return 10; // moderate
  return 0;
}

/**
 * Converts a raw OWCurrentWeather response into a risk score 0–100.
 */
export function weatherToRiskScore(weather: OWCurrentWeather): number {
  const primaryCondition = weather.weather[0];
  if (!primaryCondition) return 20;

  const base       = conditionCodeToRisk(primaryCondition.id);
  const windBonus  = windRiskBonus(weather.wind.speed, weather.wind.gust);
  const rainBonus  = rainRiskBonus(weather.rain);
  const visBonus   = visibilityRiskBonus(weather.visibility);

  return Math.min(100, base + windBonus + rainBonus + visBonus);
}

/**
 * Returns a human-readable weather description for alerts.
 */
export function weatherToAlertText(weather: OWCurrentWeather): string | null {
  const condition = weather.weather[0];
  if (!condition) return null;

  const code = condition.id;
  const desc = condition.description;

  if (code >= 200 && code < 300) return `Thunderstorm warning: ${desc}`;
  if (code >= 500 && code < 600) return `Rain on corridor: ${desc}`;
  if (code >= 600 && code < 700) return `Snow/ice conditions: ${desc}`;
  if (code === 741)               return `Dense fog reducing visibility`;
  if (code === 781)               return `Tornado warning — avoid this corridor`;
  if (weather.wind.speed > 14)    return `Strong winds (${Math.round(weather.wind.speed)} m/s) — delay likely`;

  return null;
}

// ─── API fetch helpers ────────────────────────────────────────────────────────

/**
 * Fetches current weather by coordinate pair.
 * Returns null if the API key is missing or the call fails.
 */
async function fetchWeatherByCoords(
  lat: number,
  lon: number
): Promise<OWCurrentWeather | null> {
  const apiKey = OPENWEATHER_API_KEY();
  if (!apiKey) return null;

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 }, // cache for 30 minutes
    });

    if (!res.ok) {
      console.error(`[weather] API error ${res.status} for (${lat.toFixed(3)},${lon.toFixed(3)})`);
      return null;
    }

    return await res.json() as OWCurrentWeather;
  } catch (err) {
    console.error(`[weather] Fetch failed for (${lat},${lon}):`, err);
    return null;
  }
}

/**
 * Fetches current weather by city name (string fallback for legacy city-name flows).
 * Returns null if the API key is missing or the call fails.
 */
async function fetchWeatherByCityName(city: string): Promise<OWCurrentWeather | null> {
  const apiKey = OPENWEATHER_API_KEY();
  if (!apiKey) return null;

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&appid=${apiKey}&units=metric`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      console.error(`[weather] API error ${res.status} for ${city}`);
      return null;
    }

    return await res.json() as OWCurrentWeather;
  } catch (err) {
    console.error(`[weather] Fetch failed for ${city}:`, err);
    return null;
  }
}

/**
 * Fetches 5-day / 3-hour forecast by coordinate pair.
 * Returns null on failure.
 */
export async function fetchForecastByCoords(
  lat: number,
  lon: number
): Promise<OWForecastResponse | null> {
  const apiKey = OPENWEATHER_API_KEY();
  if (!apiKey) return null;

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=40`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // cache for 1 hour — forecast data
    });

    if (!res.ok) {
      console.error(`[weather] Forecast API error ${res.status} for (${lat.toFixed(3)},${lon.toFixed(3)})`);
      return null;
    }

    return await res.json() as OWForecastResponse;
  } catch (err) {
    console.error(`[weather] Forecast fetch failed for (${lat},${lon}):`, err);
    return null;
  }
}

// ─── Weather Intelligence ─────────────────────────────────────────────────────

/**
 * Derives WeatherIntelligence from current weather + 5-day forecast.
 *
 * rain probability   — max pop (probability of precipitation) across next 24h forecast items
 * storm risk         — based on thunderstorm condition codes in forecast
 * visibility risk    — worst visibility across current + forecast
 * temp anomaly       — deviation from India's approximate seasonal norm (~28°C)
 */
export async function getWeatherIntelligence(
  lat: number,
  lon: number
): Promise<WeatherIntelligence> {
  const NEUTRAL: WeatherIntelligence = {
    rainProbability:    0,
    stormRisk:         0,
    visibilityRisk:    0,
    temperatureAnomaly: 0,
    overallRisk:       20,
    weatherAlert:      null,
    current:           null,
  };

  const apiKey = OPENWEATHER_API_KEY();
  if (!apiKey) return NEUTRAL;

  const [current, forecast] = await Promise.all([
    fetchWeatherByCoords(lat, lon),
    fetchForecastByCoords(lat, lon),
  ]);

  if (!current) return NEUTRAL;

  // ── Rain probability — from forecast pop values (next 24h = 8 x 3h slots) ──
  const next24hItems = forecast?.list?.slice(0, 8) ?? [];
  const maxPop = next24hItems.length > 0
    ? Math.max(...next24hItems.map(f => f.pop ?? 0))
    : 0;
  const rainProbability = Math.round(maxPop * 100);

  // ── Storm risk — thunderstorm code in current or next 24h ─────────────────
  const hasThunderstorm =
    current.weather.some(w => w.id >= 200 && w.id < 300) ||
    next24hItems.some(f => f.weather.some(w => w.id >= 200 && w.id < 300));
  const stormRisk = hasThunderstorm ? 85 : rainProbability > 70 ? 40 : 0;

  // ── Visibility risk ────────────────────────────────────────────────────────
  const visibilityRisk = visibilityRiskBonus(current.visibility);

  // ── Temperature anomaly — difference from ~28°C seasonal norm for India ───
  const INDIA_NORM_TEMP = 28;
  const temperatureAnomaly = Math.round(current.main.temp - INDIA_NORM_TEMP);

  // ── Overall risk ──────────────────────────────────────────────────────────
  const currentRisk   = weatherToRiskScore(current);
  const overallRisk   = Math.min(100, Math.max(currentRisk, stormRisk, Math.round(rainProbability * 0.5)));

  const weatherAlert  = weatherToAlertText(current);

  return {
    rainProbability,
    stormRisk,
    visibilityRisk,
    temperatureAnomaly,
    overallRisk,
    weatherAlert,
    current,
  };
}

// ─── Route weather assessment ─────────────────────────────────────────────────

export interface RouteWeatherResult {
  /** Composite weather risk score 0–100 for the route corridor */
  weatherScore: number;
  /** Human-readable alert if conditions are adverse */
  weatherAlert: string | null;
  /** Raw weather data for origin and destination */
  originWeather: OWCurrentWeather | null;
  destinationWeather: OWCurrentWeather | null;
}

/**
 * Fetches weather for both origin and destination by name (legacy city-string flow).
 * When coordinates are available, prefer getRouteWeatherByCoords() instead.
 *
 * Both fetches run in parallel for performance.
 * Falls back to neutral score (20) if the API key is missing or calls fail.
 */
export async function getRouteWeather(
  origin: string,
  destination: string
): Promise<RouteWeatherResult> {
  const NEUTRAL: RouteWeatherResult = {
    weatherScore: 20,
    weatherAlert: null,
    originWeather: null,
    destinationWeather: null,
  };

  const apiKey = OPENWEATHER_API_KEY();
  if (!apiKey) {
    console.warn("[weather] OPENWEATHER_API_KEY not set — using neutral weather score");
    return NEUTRAL;
  }

  // Fetch both in parallel
  const [originWeather, destinationWeather] = await Promise.all([
    fetchWeatherByCityName(origin),
    fetchWeatherByCityName(destination),
  ]);

  if (!originWeather && !destinationWeather) {
    console.warn("[weather] Both weather fetches failed — using neutral score");
    return NEUTRAL;
  }

  // Score each endpoint
  const originScore      = originWeather      ? weatherToRiskScore(originWeather)      : 20;
  const destinationScore = destinationWeather ? weatherToRiskScore(destinationWeather) : 20;

  // Use the worse of the two — conservative estimate for the corridor
  const weatherScore = Math.max(originScore, destinationScore);

  // Generate alert from the worse endpoint
  const worseWeather =
    originScore >= destinationScore ? originWeather : destinationWeather;
  const weatherAlert = worseWeather ? weatherToAlertText(worseWeather) : null;

  console.log(
    `[weather] ${origin}(${originScore}) → ${destination}(${destinationScore}) = corridor score ${weatherScore}`
  );

  return { weatherScore, weatherAlert, originWeather, destinationWeather };
}

/**
 * Fetches weather for both endpoints using coordinate pairs.
 * Preferred over getRouteWeather() when Mappls coordinates are available.
 */
export async function getRouteWeatherByCoords(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<RouteWeatherResult> {
  const NEUTRAL: RouteWeatherResult = {
    weatherScore: 20,
    weatherAlert: null,
    originWeather: null,
    destinationWeather: null,
  };

  const apiKey = OPENWEATHER_API_KEY();
  if (!apiKey) {
    console.warn("[weather] OPENWEATHER_API_KEY not set — using neutral weather score");
    return NEUTRAL;
  }

  const [originWeather, destinationWeather] = await Promise.all([
    fetchWeatherByCoords(originLat, originLon),
    fetchWeatherByCoords(destLat, destLon),
  ]);

  if (!originWeather && !destinationWeather) {
    console.warn("[weather] Both coord-based weather fetches failed — using neutral score");
    return NEUTRAL;
  }

  const originScore      = originWeather      ? weatherToRiskScore(originWeather)      : 20;
  const destinationScore = destinationWeather ? weatherToRiskScore(destinationWeather) : 20;
  const weatherScore     = Math.max(originScore, destinationScore);

  const worseWeather     = originScore >= destinationScore ? originWeather : destinationWeather;
  const weatherAlert     = worseWeather ? weatherToAlertText(worseWeather) : null;

  console.log(
    `[weather] (${originLat.toFixed(3)},${originLon.toFixed(3)})(${originScore}) → ` +
    `(${destLat.toFixed(3)},${destLon.toFixed(3)})(${destinationScore}) = corridor score ${weatherScore}`
  );

  return { weatherScore, weatherAlert, originWeather, destinationWeather };
}

// ─── Snapshot persistence ─────────────────────────────────────────────────────

export interface WeatherSnapshot {
  snapshotId:        string;
  shipmentId:        string;
  companyId:         string;
  capturedAt:        string;
  originLat?:        number;
  originLon?:        number;
  destLat?:          number;
  destLon?:          number;
  weatherScore:      number;
  rainProbability:   number;
  stormRisk:         number;
  visibilityRisk:    number;
  temperatureAnomaly: number;
  weatherAlert:      string | null;
  originCondition?:  string;
  destCondition?:    string;
}

/**
 * Persists a weather snapshot to the weather_snapshots collection.
 * Fire-and-forget — failures are logged but never rethrow.
 */
export async function saveWeatherSnapshot(snapshot: WeatherSnapshot): Promise<void> {
  try {
    const { getDb } = await import("./mongodb");
    const db = await getDb();
    await db.collection("weather_snapshots").insertOne({
      ...snapshot,
      _insertedAt: new Date().toISOString(),
    });
    console.log(`[weather] Snapshot saved for shipment ${snapshot.shipmentId}`);
  } catch (err) {
    console.error("[weather] Failed to save weather snapshot:", err);
  }
}

// ─── Coordinate-based sampling (from weather-service) ───────────────────────

export interface WeatherPoint {
  lat: number;
  lng: number;
  condition: string;
  temp: number;
  riskScore: number;
}

export async function getRouteWeatherRisk(coordinates: [number, number][]): Promise<{
  averageRisk: number;
  points: WeatherPoint[];
}> {
  const apiKey = OPENWEATHER_API_KEY();
  if (!apiKey) {
    return { averageRisk: 0, points: [] };
  }

  // Sample up to 5 evenly-spaced points from the geometry
  const step = Math.max(1, Math.floor(coordinates.length / 4));
  const sampledIndices = [0, step, step * 2, step * 3, coordinates.length - 1];
  const uniqueIndices = Array.from(new Set(sampledIndices));
  const pointsToFetch = uniqueIndices.map(i => coordinates[i]);

  const weatherPoints: WeatherPoint[] = [];

  for (const [lng, lat] of pointsToFetch) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      const condition = data.weather[0].main as string;
      const temp = data.main.temp as number;

      // Risk score based on condition
      let riskScore = 10; // Base: Clear
      if (condition === "Thunderstorm")           riskScore = 80;
      else if (condition === "Snow")              riskScore = 60;
      else if (condition === "Rain")              riskScore = 40;
      else if (condition === "Drizzle")           riskScore = 25;
      else if (condition === "Mist" || condition === "Fog") riskScore = 30;
      else if (condition === "Haze")              riskScore = 15;

      // Wind bonus
      const windSpeedMs = data.wind?.speed ?? 0;
      if (windSpeedMs > 14) riskScore = Math.min(100, riskScore + 15);

      weatherPoints.push({ lat, lng, condition, temp, riskScore });
    } catch (error) {
      console.error("[weather] Fetch error in point sampling:", error);
    }
  }

  const averageRisk = weatherPoints.length > 0
    ? Math.round(weatherPoints.reduce((acc, p) => acc + p.riskScore, 0) / weatherPoints.length)
    : 0;

  return { averageRisk, points: weatherPoints };
}
