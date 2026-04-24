/**
 * weather.ts — OpenWeather API client for SentinelRoute.
 *
 * Fetches current weather conditions for a route corridor and converts
 * them into a weather risk score (0–100) for the risk engine.
 *
 * Strategy:
 *   - Sample weather at both origin and destination
 *   - Take the worse of the two (most conservative risk estimate)
 *   - Convert weather conditions to a risk score
 *
 * API: OpenWeather Current Weather Data (free tier)
 * Docs: https://openweathermap.org/current
 *
 * Server-side only — uses OPENWEATHER_API_KEY (no NEXT_PUBLIC_ prefix).
 */

// ─── City coordinates (same as google-maps.ts) ────────────────────────────────

interface LatLng {
  lat: number;
  lon: number;
}

const CITY_COORDS: Record<string, LatLng> = {
  Chennai:     { lat: 13.0827, lon: 80.2707 },
  Bangalore:   { lat: 12.9716, lon: 77.5946 },
  Hyderabad:   { lat: 17.3850, lon: 78.4867 },
  Pune:        { lat: 18.5204, lon: 73.8567 },
  Mumbai:      { lat: 19.0760, lon: 72.8777 },
  Coimbatore:  { lat: 11.0168, lon: 76.9558 },
  Salem:       { lat: 11.6643, lon: 78.1460 },
  Thrissur:    { lat: 10.5276, lon: 76.2144 },
  Vijayawada:  { lat: 16.5062, lon: 80.6480 },
};

// ─── OpenWeather API response types (subset) ──────────────────────────────────

interface OWWeatherCondition {
  id: number;       // condition code: https://openweathermap.org/weather-conditions
  main: string;     // e.g. "Rain", "Thunderstorm", "Clear"
  description: string;
}

interface OWMain {
  temp: number;       // Kelvin
  feels_like: number;
  humidity: number;   // %
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

interface OWVisibility {
  // metres
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

function rainRiskBonus(rain?: OWRain): number {
  const mm = rain?.["1h"] ?? rain?.["3h"] ?? 0;
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

// ─── API fetch ────────────────────────────────────────────────────────────────

/**
 * Fetches current weather for a single city.
 * Returns null if the API key is missing or the call fails.
 */
async function fetchCityWeather(city: string): Promise<OWCurrentWeather | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  const coords = CITY_COORDS[city];
  let url: string;

  if (coords) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=metric`;
  } else {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&appid=${apiKey}&units=metric`;
  }

  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 }, // cache for 30 minutes — weather doesn't change that fast
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
 * Fetches weather for both origin and destination, returns the
 * worst-case weather risk score for the corridor.
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

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn("[weather] OPENWEATHER_API_KEY not set — using neutral weather score");
    return NEUTRAL;
  }

  // Fetch both in parallel
  const [originWeather, destinationWeather] = await Promise.all([
    fetchCityWeather(origin),
    fetchCityWeather(destination),
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
