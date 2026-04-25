import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = "sentinelroute";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return db;
}

export async function getShipmentsCollection() {
  const db = await connectDb();
  return db.collection("shipments");
}
