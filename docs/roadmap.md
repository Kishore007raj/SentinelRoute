# Roadmap

**Related:** [Architecture](architecture.md) · [Modules](modules.md) · [Back to README](../README.md)

---

## Near-Term Releases

| Phase | Feature |
|---|---|
| v1.1 | Fleet optimization engine -multi-vehicle dispatch coordination |
| v1.2 | Driver mobile app -React Native with live GPS push |
| v1.3 | IoT live GPS tracking -real-time vehicle position on map |
| v2.0 | Carbon-efficient routing -emissions scoring per route |
| v2.1 | Enterprise reporting suite -exportable PDF/CSV analytics |
| v2.2 | Role-based access control -dispatcher, manager, admin tiers |
| v3.0 | BigQuery analytics integration -warehouse-scale shipment intelligence |
| v3.1 | Google Cloud deployment -auto-scaling, global edge delivery |

---

## Future Platform Initiatives

| Initiative | Description |
|---|---|
| **Driver Mobile App** | React Native application with offline-capable GPS tracking, checkpoint check-in, and push notifications |
| **IoT Hardware Integration** | Real-time vehicle telematics -speed, fuel, engine diagnostics, tamper alerts |
| **ML Delay Prediction** | Trained models on historical corridor data to predict delay probability before dispatch |
| **Redis Caching Layer** | Cache-aside pattern for operational feed, health scores, and corridor statistics to reduce MongoDB read pressure |
| **Kafka Event Streaming** | Replace in-process Socket.io event emission with a durable event stream for multi-instance deployments |
| **Microservices Decomposition** | Extract recommendation engine, risk engine, and analytics into independently deployable services |
| **BigQuery Analytics Warehouse** | Mirror operational data to BigQuery for warehouse-scale historical analysis and BI tool integration |
| **Vertex AI Prediction Models** | Google Vertex AI for delay prediction, demand forecasting, and route optimization at fleet scale |
| **Google Maps Premium** | Replace OSRM + OpenStreetMap with Google Maps Platform for traffic-aware routing, real-time road conditions, and premium geocoding |
| **Digital Twin** | Simulate route conditions, weather scenarios, and fleet configurations before committing to real-world dispatch |
| **Simulation Engine** | Run what-if scenarios -e.g., "what is the risk profile if this shipment departs 6 hours later?" -without creating real records |
| **Multi-Region Deployment** | Active-active MongoDB Atlas multi-region setup with geo-routed Next.js deployments |
| **Driver Scoring Model** | Automated driver performance scoring based on on-time delivery rate, incident history, and route adherence |
| **Cargo Insurance Integration** | Real-time cargo insurance verification and automatic policy updates on shipment creation |
