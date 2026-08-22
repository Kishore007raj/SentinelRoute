/**
 * diagnose-shipment-query.js
 * 
 * Run this in MongoDB shell to analyze the shipment detail query performance.
 * 
 * Usage in mongosh:
 *   load("scripts/diagnose-shipment-query.js")
 */

const shipmentId = "shp-1787333409405";
const companyId = "co-1781546630100-tlhciy";

console.log("\n=== SHIPMENT DETAIL QUERY DIAGNOSTICS ===\n");

// 1. Execution statistics
console.log("1. QUERY EXECUTION PLAN:");
const explainOutput = db.shipments.find({
  id: shipmentId,
  companyId: companyId
}).explain("executionStats");

console.log("\nwinningPlan stage:", explainOutput.executionStats.executionStages.stage);
console.log("executionTimeMillis:", explainOutput.executionStats.executionStages.executionTimeMillis);
console.log("totalKeysExamined:", explainOutput.executionStats.totalKeysExamined);
console.log("totalDocsExamined:", explainOutput.executionStats.totalDocsExamined);
console.log("nReturned:", explainOutput.executionStats.nReturned);

if (explainOutput.executionStats.executionStages.stage === "COLLSCAN") {
  console.log("\n⚠️ WARNING: Full collection scan (COLLSCAN) - index not being used!");
} else if (explainOutput.executionStats.executionStages.stage === "IXSCAN") {
  console.log("\n✓ Index scan (IXSCAN) - index is being used");
  if (explainOutput.executionStats.executionStages.indexName) {
    console.log("Index name:", explainOutput.executionStats.executionStages.indexName);
  }
}

// 2. List available indexes
console.log("\n2. AVAILABLE INDEXES:");
const indexes = db.shipments.getIndexes();
indexes.forEach((idx, i) => {
  console.log(`  ${i}: ${idx.name} - ${JSON.stringify(idx.key)}`);
});

// 3. Document size
console.log("\n3. DOCUMENT SIZE:");
const doc = db.shipments.findOne({id: shipmentId, companyId: companyId});
if (doc) {
  const docSize = Object.bsonsize(doc);
  const geomSize = doc.geometry ? Object.bsonsize(doc.geometry) : 0;
  console.log(`Total BSON size: ${docSize} bytes`);
  console.log(`Geometry size: ${geomSize} bytes (${Math.round(geomSize / docSize * 100)}% of document)`);
  
  // Count geometry array elements
  if (Array.isArray(doc.geometry)) {
    console.log(`Geometry array length: ${doc.geometry.length} points`);
  }
} else {
  console.log("Document not found");
}

// 4. Collection stats
console.log("\n4. COLLECTION STATISTICS:");
const stats = db.shipments.stats();
console.log(`Total documents: ${stats.count}`);
console.log(`Average document size: ${Math.round(stats.avgObjSize)} bytes`);
console.log(`Total collection size: ${Math.round(stats.size / 1024 / 1024)} MB`);

// 5. Try the query without geometry
console.log("\n5. QUERY PERFORMANCE WITHOUT GEOMETRY:");
const explainWithoutGeom = db.shipments.find(
  {id: shipmentId, companyId: companyId},
  {geometry: 0}
).explain("executionStats");
console.log("executionTimeMillis:", explainWithoutGeom.executionStats.executionStages.executionTimeMillis);

// 6. Index recommendation
console.log("\n6. INDEX RECOMMENDATIONS:");
if (explainOutput.executionStats.executionStages.stage === "COLLSCAN") {
  console.log("ADD THIS INDEX:");
  console.log('db.shipments.createIndex({id: 1, companyId: 1}, {background: true})');
} else {
  console.log("✓ Index optimization appears adequate");
}

console.log("\n=== END DIAGNOSTICS ===\n");
