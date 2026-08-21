# Shipment Detail Performance - Action Plan

## Current Status

**GET /api/shipments/[id]** takes **8-13 seconds** consistently.

Shipment lookup query: **8-9 seconds** (the bottleneck)

Query: `{id: "shp-1787333409405", companyId: "co-1781546630100-tlhciy"}`

## Changes Deployed (This Session)

### Code Changes (Non-Breaking Diagnostics Only)

#### 1. `src/app/api/shipments/[id]/route.ts`

Added stage-by-stage timing measurements:

```typescript
// Stage A: Cursor creation time
// Stage B: MongoDB execution time (cursor.next())
// Stage C: JSON serialization time
// Measures: document size, geometry size, response serialization
```

**Output in logs:**
```
[GET /api/shipments/[id]] Cursor creation: Xms
[GET /api/shipments/[id]] MongoDB execution (next): Xms
[GET /api/shipments/[id]] Document sizes - Total: XXXX bytes, Geometry: XXXX bytes
[GET /api/shipments/[id]] JSON.stringify time: Xms
[GET /api/shipments/[id]] Total shipment lookup: Xms (cursor: Xms, exec: Xms, serialize: Xms)
[GET /api/shipments/[id]] Response JSON.stringify: Xms, size: XXXX bytes
```

This tells us EXACTLY which stage takes the 8 seconds.

#### 2. `scripts/diagnose-shipment-query.js`

MongoDB diagnostic script to run in mongosh shell.

**Provides:**
- Query execution plan (IXSCAN vs COLLSCAN)
- Index being used (name)
- Execution time in MongoDB
- Document and geometry sizes
- Index recommendations

**Usage:**
```bash
mongosh <connection-string>
load("scripts/diagnose-shipment-query.js")
```

### Documentation Created

1. **SHIPMENT_DETAIL_DIAGNOSTIC_CHECKLIST.md**
   - Step-by-step diagnostic process
   - Decision tree for finding root cause
   - What to look for in logs
   - Expected values for healthy system

2. **SHIPMENT_PERFORMANCE_ACTION_PLAN.md** (this file)
   - Summary of all changes
   - What to measure next
   - How to interpret findings

## Next Steps (Required)

### 1. Restart Server and Capture Logs (5-10 minutes)

```bash
npm run dev
# OR
npm run build
npm start
```

Load shipment detail page for `shp-1787333409405`:
```
GET /api/shipments/shp-1787333409405?companyId=co-1781546630100-tlhciy
```

**Observe logs:**
- Which stage takes the 8-9 seconds?
- What are the document sizes?
- Is serialization fast or slow?

### 2. Run MongoDB Diagnostics

In MongoDB shell:
```bash
mongosh <MONGODB_URI>
load("scripts/diagnose-shipment-query.js")
```

**Answers:**
- Is the query using IXSCAN (index scan) or COLLSCAN (full table scan)?
- What index is being used?
- How long does MongoDB report for execution?
- Are the keys/docs examined reasonable?

### 3. Interpret Results Using Decision Tree

From SHIPMENT_DETAIL_DIAGNOSTIC_CHECKLIST.md:

**If MongoDB execution (next): > 7 seconds**
- Check explain() output
- If COLLSCAN: index missing
- If IXSCAN but slow: MongoDB server issue

**If JSON.stringify: > 5 seconds**
- Geometry is huge
- Check geometry array size

**If all stages fast but total > 8s**
- Connection pool wait time
- Network latency

## Constraints (DO NOT VIOLATE)

✓ DO keep geometry (Leaflet route depends on it)  
✓ DO fix with minimal targeted change  
✓ DO verify with `npm run build` before committing  
✓ DO test full shipment lifecycle after fix

✗ DON'T remove geometry  
✗ DON'T add random indexes  
✗ DON'T modify timestamps  
✗ DON'T convert 404 to 200  
✗ DON'T create fake execution records  

## Expected Outcome

After fixing, you should see:

**GET /api/shipments/[id] response times:**
- List page (29 docs, no geometry): 450-650ms
- Detail page (1 doc, with geometry): 300-1000ms (depends on geometry size)

**NOT** 8-13 seconds

## If Diagnostics Show MongoDB Issue

Example findings that would require action:

**Scenario 1: COLLSCAN (index missing)**
```
stage: COLLSCAN
totalDocsExamined: 1000000  (scanning whole collection!)
totalKeysExamined: 0
```
**Fix:** Create index on `{id: 1, companyId: 1}`

**Scenario 2: Large geometry**
```
Geometry size: 5MB (50% of document)
Geometry array length: 100000 points
```
**Fix:** Could review route optimization, or accept that large geometry takes time

**Scenario 3: Connection pool saturation**
```
Cursor creation: 5000ms (waiting for connection)
MongoDB execution: 50ms (once connected, fast)
```
**Fix:** Increase maxPoolSize or optimize concurrent queries

**Scenario 4: MongoDB slow**
```
MongoDB execution: 7000ms
stage: IXSCAN
totalKeysExamined: 1
```
**Fix:** Check MongoDB server health, network latency

## Verification After Fix

Once you believe the issue is fixed:

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Test manually:
# 1. Load shipment list
# 2. Click into shipment detail
# 3. Verify geometry renders on map
# 4. Refresh several times
# 5. Time the response (should be < 2s)
# 6. Verify 404 for execution (if no execution doc)
# 7. Go through shipment workflow (assign, start, etc.)
```

## Evidence Requirements

Before declaring "fixed", document:

1. **Before state logs** (current 8-9s)
   ```
   Shipment lookup: 8486ms
   GET /api/shipments/[id]: 11.0s
   ```

2. **Root cause identified**
   ```
   MongoDB execution time: 7000ms (or JSON.stringify: 5000ms, etc.)
   ```

3. **Fix applied**
   ```
   Code change: [description]
   Index created: [index definition]
   MongoDB version: [if relevant]
   ```

4. **After state logs** (target: < 2s)
   ```
   Shipment lookup: 600ms
   GET /api/shipments/[id]: 800ms
   ```

5. **Tests pass**
   ```
   tsc: no errors
   lint: no errors
   build: successful
   manual: shipment detail page works, geometry renders
   ```

## Why This Matters

- Shipment detail page is critical UX (drivers need fast status checks)
- 8-13 second load is unusable for operational staff
- Route geometry requires full shipment fetch (cannot exclude)
- Finding root cause first prevents misguided optimizations

## Support

If you get stuck:

1. Check SHIPMENT_DETAIL_DIAGNOSTIC_CHECKLIST.md for decision tree
2. Run `scripts/diagnose-shipment-query.js` in MongoDB
3. Match your log output to "Decision Tree" section
4. Report findings with evidence before making changes
