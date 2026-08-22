# Shipment Detail Query Diagnostic Checklist

## Problem Statement

**GET /api/shipments/[id]** consistently takes **8-13 seconds**, with the shipment lookup query accounting for **8-9 seconds** of that time.

Query: `{id: "shp-1787333409405", companyId: "co-1781546630100-tlhciy"}`

Returning 1 document with geometry array.

## Diagnostic Steps (DO NOT GUESS)

### Step 1: Measure Query Execution Stages

New logging has been added to measure each stage separately:
- Cursor creation time
- MongoDB execution time (`cursor.next()`)
- JSON.stringify time
- Document and geometry sizes
- Response serialization time

**Check logs for:**
```
[GET /api/shipments/[id]] Cursor creation: Xms
[GET /api/shipments/[id]] MongoDB execution (next): Xms
[GET /api/shipments/[id]] Document sizes - Total: XXXX bytes, Geometry: XXXX bytes
[GET /api/shipments/[id]] JSON.stringify time: Xms
[GET /api/shipments/[id]] Total shipment lookup: Xms (cursor: Xms, exec: Xms, serialize: Xms)
[GET /api/shipments/[id]] Response JSON.stringify: Xms, size: XXXX bytes
```

**This tells us:** Which stage consumes the 8-9 seconds

### Step 2: Run MongoDB Explain Analysis

Execute the diagnostic script in MongoDB shell:

```bash
# Connect to MongoDB
mongosh <MONGODB_CONNECTION_STRING>

# Load and run the diagnostic script
load("scripts/diagnose-shipment-query.js")
```

**This returns:**
- `stage`: IXSCAN vs COLLSCAN (is the index being used?)
- `executionTimeMillis`: MongoDB internal execution time
- `totalKeysExamined`: How many index keys were scanned
- `totalDocsExamined`: How many documents were examined
- `nReturned`: Should be 1
- Index name: Which index is being used

**Expected values if working correctly:**
```
stage: "IXSCAN"
executionTimeMillis: 10-50ms (fast index scan)
totalKeysExamined: 1
totalDocsExamined: 1
nReturned: 1
```

### Step 3: Analyze Geometry Size

From logs or script output, check:

```
Geometry size: XXXX bytes (YY% of document)
Geometry array length: NNN points
```

**Question:** Is the geometry array unusually large?

If `Geometry size > 500KB`, the BSON transfer time could explain 1-2 seconds.

If `Geometry array length > 10,000 points`, serialization could account for some time.

### Step 4: Compare Query Performance Modes

The diagnostic script tests two modes:

**Mode 1: Full document (current)**
```javascript
db.shipments.find({id: "shp-1787333409405", companyId: "co-1781546630100-tlhciy"})
  .explain("executionStats")
```

**Mode 2: Exclude geometry**
```javascript
db.shipments.find({id: "shp-1787333409405", companyId: "co-1781546630100-tlhciy"}, {geometry: 0})
  .explain("executionStats")
```

If Mode 2 is significantly faster, the issue is **geometry transfer/serialization overhead**, not the query itself.

### Step 5: Check MongoDB Connection Latency

The `getDb()` timing shows connection pool is fast (1-2ms).

But check for:
- Network round-trip time to MongoDB (should be <10ms for local)
- MongoDB server response time (check MongoDB logs)
- Connection pool wait time (if pool is exhausted, queries queue)

**Test:**
```javascript
// In MongoDB shell
db.adminCommand({ping: 1})  // Should be instant
```

### Step 6: Concurrent Request Behavior

The logs show MANY simultaneous requests:
```
/api/shipments
/api/operational/feed
/api/workforce/drivers
/api/workforce/vehicles
/api/intelligence/incidents
```

**Check:** Do all slow down at the same time? If yes, suggests **connection pool saturation**.

**Verify:**
```javascript
// In MongoDB shell
db.stats()  // Check storage size
db.serverStatus().connections  // Current connections
```

### Step 7: Index Verification

The diagnostic script lists all indexes on shipments collection.

Look for:
- `shipments_id`: exists (single field)
- `shipments_id_companyId`: exists (compound)

**Expected indexes:**
```
_id_: unique index on _id (always present)
shipments_id: unique index on {id: 1}
shipments_id_companyId: index on {id: 1, companyId: 1}
shipments_companyId_createdAt: index on {companyId: 1, createdAt: -1}
```

If `shipments_id_companyId` doesn't exist and explain() shows COLLSCAN, that's the issue.

## Decision Tree

```
8-9 second shipment lookup
│
├─→ MongoDB execution (next): > 7 seconds?
│   │
│   ├─→ YES: Problem is at MongoDB server
│   │   │
│   │   ├─→ explain() shows COLLSCAN?
│   │   │   ├─→ YES: Missing index on {id, companyId}
│   │   │   │        ACTION: Create index
│   │   │   │
│   │   │   └─→ NO: IXSCAN but slow
│   │   │        CHECK: MongoDB logs for locks, slow queries
│   │   │        CHECK: Connection pool saturation
│   │   │
│   │   └─→ Other checks:
│   │       - Document size (BSON transfer time)
│   │       - MongoDB CPU/memory usage
│   │       - Network latency to MongoDB
│   │
│   └─→ NO: Problem is serialization/transfer
│       │
│       ├─→ JSON.stringify time > 5 seconds?
│       │   ├─→ YES: Geometry size is huge
│       │   │        ACTION: Review route points
│       │   │
│       │   └─→ NO: Response transfer time > 5 seconds?
│       │       └─→ YES: Network bandwidth issue
│       │
│       └─→ Cursor creation > 1 second?
│           └─→ YES: Connection pool wait time
│
└─→ Check concurrent requests:
    All slow at same time? → Connection pool exhaustion
    Only this endpoint slow? → Query-specific issue
```

## DO NOT

1. ❌ Remove geometry (Leaflet route depends on it)
2. ❌ Create fake execution records
3. ❌ Convert 404 to 200
4. ❌ Add indexes blindly without explain() proof
5. ❌ Modify schema or timestamps
6. ❌ Change Firebase authentication
7. ❌ Modify route optimization logic

## DO

1. ✓ Run the explain() diagnostics
2. ✓ Measure each stage separately
3. ✓ Check MongoDB logs
4. ✓ Verify indexes exist and are being used
5. ✓ Test in isolation vs concurrent requests
6. ✓ Measure geometry size
7. ✓ Report findings with evidence
8. ✓ Make minimal targeted fix after diagnosis

## Expected Results (Healthy System)

After diagnostics, you should see:
```
Cursor creation: 1-5ms
MongoDB execution: 50-200ms (index scan)
JSON.stringify: 50-100ms
Document size: 100-500KB
Geometry size: 50-200KB
Total: 200-400ms (acceptable)
```

If total > 8 seconds, one stage will dominate. That stage is where the fix is needed.
