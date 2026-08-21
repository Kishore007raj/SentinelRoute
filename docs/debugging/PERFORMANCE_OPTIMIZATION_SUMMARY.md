# Performance Optimization Summary

## Performance Improvements Made

### Indexes Added
Added 13 new database indexes to `mongodb-indexes.ts` to optimize slow API endpoints:

#### Shipments Collection
- `shipments_companyId_status_createdAt` - Compound index for list queries
- `shipments_id` - Fast point lookups for single shipment details

#### Shipment Executions Collection
- `executions_driverId_status` - Driver assignment queries
- `executions_companyId_status` - Fleet status queries

#### Drivers Collection (6 indexes)
- `drivers_driverId_unique` - Primary lookup
- `drivers_companyId` - Company-scoped queries
- `drivers_companyId_branchId` - Branch filtering
- `drivers_operationalStatus` - Status filtering
- `drivers_assignedVehicleId` - Vehicle assignment lookups
- `drivers_createdAt_desc` - Sort by creation date

#### Vehicles Collection (7 indexes)
- `vehicles_vehicleId_unique` - Primary lookup
- `vehicles_companyId` - Company-scoped queries
- `vehicles_companyId_branchId` - Branch filtering
- `vehicles_status` - Status queries
- `vehicles_operationalStatus` - Operational status filtering
- `vehicles_currentDriverId` - Driver assignment lookups
- `vehicles_createdAt_desc` - Sort by creation date

### Results

| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| GET /api/shipments | 885ms (docs: 544ms) | 598ms | **33% faster** |
| GET /api/workforce/drivers | 1289ms | 196ms | **85% faster** |
| GET /api/workforce/vehicles | 1345ms | 197ms | **85% faster** |
| GET /api/operational/feed | 461ms | 215ms | **53% faster** |

### Diagnostics Added

Added performance logging to `GET /api/shipments/[id]`:
```
[GET /api/shipments/[id]] getDb() took Xms
[GET /api/shipments/[id]] User lookup took Xms
[GET /api/shipments/[id]] Shipment lookup took Xms for query: {...}
```

This helps diagnose whether slowness is in:
1. Database connection time
2. User authorization lookup
3. Shipment document retrieval

## Remaining Performance Bottleneck

### GET /api/shipments/[id] - Still 7-9 seconds

**Status:** Investigation ongoing

**Observations:**
- Consistently slow (7-9s) across multiple requests - not a cache issue
- application-code: 7-9s (slowest component)
- Database indexes are in place: `shipments_id` unique index
- Only 2 database queries (user lookup + shipment lookup)
- No expensive post-processing (decryption, etc.)

**Likely Causes:**
1. **Network latency** to MongoDB instance
2. **Large document transfer** (shipment with geometry array)
3. **Slow MongoDB query planner** choosing inefficient execution plan
4. **Connection pool saturation** causing request queuing

**Recommendations:**

1. **Enable Query Profiling**
   ```bash
   # Check MongoDB slow query log
   # MongoDB Enterprise Edition: Enable profiling
   db.setProfilingLevel(2)  # Profile all queries
   db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()
   ```

2. **Verify Index Usage**
   ```bash
   # Check if the index is being used for shipment lookups
   db.shipments.aggregate([
     {$match: {id: "shp-1787333409405"}},
     {$explain: "executionStats"}
   ])
   ```

3. **Profile Database Connectivity**
   - Measure round-trip time to MongoDB
   - Check network bandwidth
   - Monitor MongoDB connection pool status

4. **Check Large Documents**
   ```bash
   # Find oversized shipments with large geometry arrays
   db.shipments.aggregate([
     {
       $addFields: {
         docSize: {$bsonSize: "$$ROOT"}
       }
     },
     {
       $sort: {docSize: -1}
     },
     {
       $limit: 10
     }
   ])
   ```

5. **Apply Query Hints** (if needed)
   If MongoDB is choosing the wrong execution plan:
   ```typescript
   const doc = await db
     .collection("shipments")
     .findOne(query, { hint: {id: 1} });
   ```

## Indexes Auto-Enabled

All indexes are created automatically on app startup via `ensureIndexes()`:
- Runs once per process
- Fire-and-forget (never blocks requests)
- Logs: `[mongodb-indexes] All indexes ensured.`

## Next Steps

1. Check MongoDB logs for slow query profiles
2. Verify network connectivity to database server
3. Consider connection pooling optimization
4. Profile the actual shipment query execution plan
5. Check if geometry arrays are unnecessarily large

## Files Modified

- `src/lib/mongodb-indexes.ts` - Added 13 new indexes
- `src/app/api/shipments/[id]/route.ts` - Added performance logging
