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
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return { averageRisk: 0, points: [] };
  }

  // Sample 5 points from the geometry
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
      const condition = data.weather[0].main;
      const temp = data.main.temp;

      let riskScore = 10; // Base: Clear
      if (condition === "Rain") riskScore = 40;
      if (condition === "Drizzle") riskScore = 25;
      if (condition === "Thunderstorm") riskScore = 80;
      if (condition === "Snow") riskScore = 60;
      if (condition === "Mist" || condition === "Fog") riskScore = 30;

      weatherPoints.push({
        lat,
        lng,
        condition,
        temp,
        riskScore
      });
    } catch (error) {
      console.error("Weather fetch error:", error);
    }
  }

  const averageRisk = weatherPoints.length > 0 
    ? weatherPoints.reduce((acc, p) => acc + p.riskScore, 0) / weatherPoints.length 
    : 0;

  return {
    averageRisk,
    points: weatherPoints
  };
}
