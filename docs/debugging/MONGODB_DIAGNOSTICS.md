# MongoDB Performance Diagnostics

## Quick Diagnostics Checklist

### 1. Check Index Status

Run these in MongoDB shell (`mongosh`):

```javascript
// List all indexes on shipments collection
db.shipments.getIndexes()

// List all indexes on drivers collection  
db.drivers.getIndexes()

// List all indexes on vehicles collection
db.vehicles.getIndexes()
```

### 2. Analyze Specific Query Performance

```javascript
// Check if shipments_id index is being used
db.shipments.find({id: "shp-1787333409405"}).explain("executionStats")

// Check compound query performance
db.shipments.find({id: "shp-1787333409405", companyId: "co-1781546630100-tlhciy"}).explain("executionStats")

// Check drivers collection query
db.drivers.find({companyId: "co-1781546630100-tlhciy"}).explain("executionStats")

// Check vehicles collection query
db.vehicles.find({companyId: "co-1781546630100-tlhciy"}).explain("executionStats")
```

**Look for:**
- `executionStage.stage`: Should be `COLLSCAN` → index is being used
- `executionStages.executionStages`: Multiple stages means query is complex
- `nDocsExamined` vs `nReturned`: Should be similar (low scanning overhead)

### 3. Monitor Slow Queries

```javascript
// Enable profiling on database
db.setProfilingLevel(2)  // 0=off, 1=slow queries, 2=all

// View profiling results
db.system.profile.find().limit(5).sort({ts: -1}).pretty()

// Disable profiling
db.setProfilingLevel(0)
```

### 4. Check Document Sizes

```javascript
// Find the largest shipment documents
db.shipments.aggregate([
  {
    $addFields: {
      size: {$bsonSize: "$$ROOT"},
      geometrySize: {
        $cond: [
          {$isArray: "$geometry"},
          {$size: "$geometry"},
          0
        ]
      }
    }
  },
  {$sort: {size: -1}},
  {$limit: 10},
  {$project: {
    id: 1,
    size: 1,
    geometrySize: 1,
    companyId: 1,
    status: 1
  }}
])
```

### 5. Connection Pool Status

```javascript
// Check MongoDB connection status from Node.js
// Add this temporarily to your route:
const stats = db.stats();
console.log("DB Stats:", stats);

// Or check driver connection pool
const client = await getDb().client;
const poolStats = client.topology.connectionPool;
console.log("Pool Stats:", poolStats);
```

### 6. Network Diagnostics

Run from your application server:

```bash
# Ping MongoDB server (test latency)
ping <mongodb-host>

# Measure round-trip time
curl -I mongodb://<mongodb-host>:<port>

# Check network bandwidth
iperf -c <mongodb-host>
```

### 7. MongoDB Server Metrics

```javascript
// Get server status
db.serverStatus()

// Analyze connections
db.serverStatus().connections

// Check memory usage
db.serverStatus().mem

// Check lock statistics
db.serverStatus().locks

// Check replication lag (if replica set)
rs.printSecondaryReplicationInfo()
```

## Performance Baseline

Document the current baseline:

```javascript
// Run before and after optimizations
db.shipments.find({id: "shp-1787333409405"}).explain("executionStats")

// Save output for comparison:
// - executionStats.executionStages.stage
// - executionStats.nDocsExamined
// - executionStats.executionStats.executionStages.executionStats.nReturned
// - executionStats.totalDocsExamined
```

## Expected Index Behavior

After indexes are created:

### shipments_id index
- **Query:** `{id: "..."}`
- **Expected Stage:** `IXSCAN` (Index Scan)
- **Expected Documents:** 1
- **Expected Examined:** 1

### shipments_companyId_status_createdAt index
- **Query:** `{companyId: "...", status: "active", createdAt: -1}`
- **Expected Stage:** `IXSCAN` + `SORT`
- **Expected Documents:** ~N (all matching docs)
- **Expected Examined:** ~N (efficient filtering)

### drivers_companyId index
- **Query:** `{companyId: "..."}`
- **Expected Stage:** `IXSCAN`
- **Expected Documents:** ~M (all drivers in company)
- **Expected Examined:** ~M

### vehicles_companyId index
- **Query:** `{companyId: "..."}`
- **Expected Stage:** `IXSCAN`
- **Expected Documents:** ~K (all vehicles in company)
- **Expected Examined:** ~K

## Slow Query Symptoms

If queries are still slow despite indexes:

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| `nDocsExamined >> nReturned` | Bad query plan | Use query hints or rebuild index |
| `totalDocsExamined` includes all docs | Index not being used | Check index definition and query |
| Multiple index scans | Complex filter | Simplify query or add compound index |
| High `executionStages` count | Many filter stages | Add more specific index |
| `COLLSCAN` stage | Full table scan | Add index that matches query filter |

## Recovery Steps

If performance degrades:

```javascript
// 1. Rebuild indexes
db.shipments.reIndex()
db.drivers.reIndex()
db.vehicles.reIndex()

// 2. Drop and recreate specific index
db.shipments.dropIndex("shipments_id")
db.shipments.createIndex({id: 1}, {background: true})

// 3. Analyze query plan again
db.shipments.find({id: "..."}).explain("executionStats")
```

## Monitoring Script

Create `check-db-health.js`:

```javascript
const { MongoClient } = require("mongodb");

async function checkDBHealth() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log("📊 MongoDB Health Check\n");
    
    // Check server status
    const serverStatus = await db.admin().serverStatus();
    console.log(`✓ Connections: ${serverStatus.connections.current} current`);
    console.log(`✓ Memory: ${Math.round(serverStatus.mem.resident)}MB resident\n`);
    
    // Check indexes
    const shipmentIndexes = await db.collection("shipments").getIndexes();
    console.log(`✓ Shipments indexes: ${Object.keys(shipmentIndexes).length}`);
    
    const driverIndexes = await db.collection("drivers").getIndexes();
    console.log(`✓ Drivers indexes: ${Object.keys(driverIndexes).length}`);
    
    const vehicleIndexes = await db.collection("vehicles").getIndexes();
    console.log(`✓ Vehicles indexes: ${Object.keys(vehicleIndexes).length}\n`);
    
    // Sample query execution
    console.log("📈 Query Performance:\n");
    
    const shipmentExplain = await db
      .collection("shipments")
      .find({id: "shp-1787333409405"})
      .explain("executionStats");
    console.log(`✓ Shipment detail: ${shipmentExplain.executionStats.executionStages.stage}`);
    
    const driversExplain = await db
      .collection("drivers")
      .find({companyId: "co-1781546630100-tlhciy"})
      .limit(100)
      .explain("executionStats");
    console.log(`✓ Drivers list: ${driversExplain.executionStats.executionStages.stage}`);
    
  } finally {
    await client.close();
  }
}

checkDBHealth().catch(console.error);
```

Run with:
```bash
node check-db-health.js
```

## Resources

- [MongoDB Query Optimization](https://docs.mongodb.com/manual/tutorial/optimize-query-performance-with-indexes-and-projections/)
- [MongoDB Explain Output](https://docs.mongodb.com/manual/reference/explain-results/)
- [Index Strategies](https://docs.mongodb.com/manual/indexes/)
- [Performance Monitoring](https://docs.mongodb.com/manual/administration/monitoring/)
