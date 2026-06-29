import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sentinelroute";

const FESTIVALS_TO_SEED = [
  {
    id: "ratha-yatra-2026",
    name: "Ratha Yatra",
    state: "OR",
    startDate: "2026-07-14",
    endDate: "2026-07-16",
    congestionMultiplier: 2.3,
    riskLevel: "critical",
    affectedStates: ["OR", "WB"],
  },
  {
    id: "raksha-bandhan-2026",
    name: "Raksha Bandhan",
    state: "national",
    startDate: "2026-08-28",
    endDate: "2026-08-28",
    congestionMultiplier: 1.5,
    riskLevel: "medium",
    affectedStates: ["all"],
  },
  {
    id: "independence-day-2026",
    name: "Independence Day",
    state: "national",
    startDate: "2026-08-15",
    endDate: "2026-08-15",
    congestionMultiplier: 1.8,
    riskLevel: "high",
    affectedStates: ["all"],
  },
  {
    id: "kanwar-yatra-2026",
    name: "Kanwar Yatra",
    state: "UP",
    startDate: "2026-07-20",
    endDate: "2026-08-05",
    congestionMultiplier: 2.1,
    riskLevel: "high",
    affectedStates: ["UP", "UK", "HR", "DL"],
  },
  {
    id: "ambubachi-mela-2026",
    name: "Ambubachi Mela",
    state: "AS",
    startDate: "2026-06-22",
    endDate: "2026-06-26",
    congestionMultiplier: 1.9,
    riskLevel: "high",
    affectedStates: ["AS"],
  },
  {
    id: "monsoon-session-parliament-2026",
    name: "Monsoon Session Parliament (Delhi Congestion)",
    state: "DL",
    startDate: "2026-07-20",
    endDate: "2026-08-10",
    congestionMultiplier: 1.4,
    riskLevel: "medium",
    affectedStates: ["DL"],
  }
];

async function seedFestivals() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const col = db.collection("festivals");

    console.log("Seeding June-August 2026 logistics bottlenecks...");

    for (const fest of FESTIVALS_TO_SEED) {
      await col.updateOne({ id: fest.id }, { $set: fest }, { upsert: true });
      console.log(`Upserted festival: ${fest.name} (${fest.id})`);
    }

    console.log("Seeding completed successfully.");
  } catch (error) {
    console.error("Error seeding festivals:", error);
  } finally {
    await client.close();
  }
}

seedFestivals();
