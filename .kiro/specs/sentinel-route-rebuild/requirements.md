# Requirements Document

## Introduction

SentinelRoute is a full-stack logistics and shipment tracking system built on Next.js App Router. This document specifies the requirements for a complete rebuild of the existing application. The rebuild eliminates all Firestore dependencies, all Google Maps dependencies, and all mock/in-memory data. Every piece of state is persisted in MongoDB. Routing is powered by OSRM, weather data by OpenWeather, AI explanations by Gemini, real-time sync by Socket.io, and authentication by Firebase Auth. Zod validates every inbound API payload before any database write occurs.

---

## Glossary

- **System**: The SentinelRoute Next.js application as a whole.
- **API**: The Next.js App Router API route layer (`/api/*`).
- **MongoDB**: The sole persistent data store; all reads and writes target MongoDB.
- **Shipment**: A logistics record conforming to the `Shipment` interface defined in this document.
- **ShipmentId**: A unique string identifier in the format `SR-XXXX` (e.g. `SR-4271`).
- **OSRM**: Open Source Routing Machine; the exclusive routing engine.
- **OpenWeather**: The weather data provider used to score route conditions.
- **Gemini**: Google's generative AI API used to produce one human-readable explanation per shipment.
- **Socket.io**: The WebSocket library used for real-time UI synchronisation.
- **Firebase_Auth**: Firebase Authentication; the exclusive identity provider.
- **Zod**: The TypeScript-first schema validation library; mandatory for all API input validation.
- **RiskEngine**: The deterministic, formula-based component that computes `riskScore` and `riskLevel`.
- **WeatherSampler**: The component that samples exactly 5 evenly spaced points from an OSRM route geometry and fetches weather for each.
- **RouteGeometry**: The GeoJSON LineString returned by OSRM in the `routes[0].geometry` field.
- **WeatherFactor**: The average weather score across the 5 sampled route points.
- **RiskScore**: A numeric value computed deterministically by the RiskEngine formula.
- **RiskLevel**: A categorical label derived from RiskScore — `"Low"` (0–10), `"Medium"` (10–20), or `"High"` (>20).
- **AuthContext**: The React context that holds the resolved Firebase Auth user and exposes it application-wide.
- **SocketClient**: The client-side Socket.io instance that connects on application load.
- **SocketServer**: The server-side Socket.io instance initialised once per server process.

---

## Requirements

---

### Requirement 1: Data Model and MongoDB Persistence

**User Story:** As a logistics operator, I want all shipment data to be stored in and retrieved from MongoDB, so that data is never lost between sessions or page refreshes.

#### Acceptance Criteria

1. THE System SHALL define the `Shipment` document with exactly the following fields: `_id` (ObjectId), `shipmentId` (string), `origin` (object with `lat: number` and `lng: number`), `destination` (object with `lat: number` and `lng: number`), `status` (`"pending" | "in_transit" | "completed"`), `deadline` (Date), `distanceKm` (number), `durationHours` (number), `riskScore` (number), `riskLevel` (`"Low" | "Medium" | "High"`), `aiExplanation` (string), `createdAt` (Date), `updatedAt` (Date).
2. THE System SHALL create a unique index on the `shipmentId` field in the `shipments` MongoDB collection.
3. THE System SHALL create a descending index on the `createdAt` field in the `shipments` MongoDB collection.
4. THE System SHALL create an index on the `status` field in the `shipments` MongoDB collection.
5. WHEN a shipment is created or updated, THE System SHALL write the full document to MongoDB before returning a response to the caller.
6. WHEN a shipment is read, THE API SHALL retrieve it from MongoDB and return the persisted document.
7. IF a MongoDB write operation fails, THEN THE API SHALL return an HTTP 500 response with `{ "success": false, "error": "<message>" }` and SHALL NOT return a success response.
8. THE System SHALL contain no Firestore imports, no Firestore SDK calls, and no Firestore configuration anywhere in the codebase.
9. THE System SHALL contain no in-memory arrays, no module-level state, and no mock data files used as a data source.

---

### Requirement 2: Shipment ID Generation

**User Story:** As a logistics operator, I want each shipment to have a unique, human-readable identifier, so that I can reference shipments unambiguously in communications.

#### Acceptance Criteria

1. WHEN a new shipment is created, THE API SHALL generate a `shipmentId` using the pattern `SR-` followed by a random integer in the range 1000–9999 inclusive.
2. WHEN a candidate `shipmentId` is generated, THE API SHALL query MongoDB to verify the candidate does not already exist in the `shipments` collection.
3. IF the candidate `shipmentId` already exists in MongoDB, THEN THE API SHALL generate a new candidate and repeat the uniqueness check until a unique value is confirmed.
4. THE API SHALL only proceed with shipment creation after MongoDB has confirmed the `shipmentId` is unique.

---

### Requirement 3: Input Validation with Zod

**User Story:** As a system operator, I want all API inputs to be validated before any processing or database write, so that malformed data never reaches MongoDB.

#### Acceptance Criteria

1. THE API SHALL define a Zod schema for the `POST /api/shipments` request body that requires `origin.lat` (number), `origin.lng` (number), `destination.lat` (number), `destination.lng` (number), and `deadline` (valid ISO 8601 date string).
2. WHEN a `POST /api/shipments` request is received, THE API SHALL validate the request body against the Zod schema before executing any other logic.
3. IF Zod validation fails, THEN THE API SHALL return HTTP 400 with `{ "success": false, "error": "<validation message>" }` and SHALL NOT call OSRM, OpenWeather, Gemini, or MongoDB.
4. THE API SHALL define a Zod schema for the `PATCH /api/shipments/:id` request body that requires `status` to be one of `"pending"`, `"in_transit"`, or `"completed"`.
5. IF the `PATCH /api/shipments/:id` Zod validation fails, THEN THE API SHALL return HTTP 400 with `{ "success": false, "error": "<validation message>" }` and SHALL NOT write to MongoDB.
6. THE System SHALL use Zod for all API input validation and SHALL NOT use manual field-presence checks as the primary validation mechanism.

---

### Requirement 4: Standard API Response Format

**User Story:** As a frontend developer, I want all API responses to follow a consistent envelope format, so that error handling and data extraction are predictable across the application.

#### Acceptance Criteria

1. THE API SHALL return all successful responses in the format `{ "success": true, "data": <payload> }`.
2. THE API SHALL return all error responses in the format `{ "success": false, "error": "<message>" }`.
3. THE API SHALL return HTTP 201 for successful `POST /api/shipments` responses.
4. THE API SHALL return HTTP 200 for successful `GET /api/shipments` responses.
5. THE API SHALL return HTTP 200 for successful `PATCH /api/shipments/:id` responses.
6. THE API SHALL return HTTP 400 for validation failures.
7. THE API SHALL return HTTP 401 when a request is made without a valid authenticated user.
8. THE API SHALL return HTTP 500 for unhandled server errors.

---

### Requirement 5: Shipment Creation Pipeline (POST /api/shipments)

**User Story:** As a logistics operator, I want to create a shipment by providing origin, destination, and deadline coordinates, so that the system computes routing, weather risk, and an AI explanation automatically.

#### Acceptance Criteria

1. WHEN a valid `POST /api/shipments` request is received, THE API SHALL execute the following steps in order: (1) validate input with Zod, (2) generate a unique `shipmentId`, (3) call OSRM to obtain route data, (4) sample 5 route points and call OpenWeather in parallel, (5) compute `weatherFactor`, (6) compute `riskScore` and `riskLevel` using the RiskEngine formula, (7) call Gemini exactly once, (8) write the complete shipment document to MongoDB, (9) emit a `shipment_created` Socket.io event, (10) return the HTTP 201 response.
2. THE API SHALL call Gemini exactly once per shipment creation request.
3. THE API SHALL NOT call Gemini before the `riskScore` has been computed.
4. THE API SHALL NOT write to MongoDB before all of steps 1–7 have completed successfully.
5. IF OSRM returns no route, THEN THE API SHALL return HTTP 422 with `{ "success": false, "error": "No route found between the provided coordinates" }`.

---

### Requirement 6: OSRM Routing Integration

**User Story:** As a logistics operator, I want route distance and duration to be computed from real road network data, so that shipment estimates are accurate.

#### Acceptance Criteria

1. WHEN computing a route, THE API SHALL call OSRM using the URL pattern `/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`.
2. WHEN OSRM returns a successful response, THE API SHALL extract `distanceKm` as `routes[0].distance / 1000` and `durationHours` as `routes[0].duration / 3600`.
3. WHEN OSRM returns a successful response, THE API SHALL extract the `RouteGeometry` from `routes[0].geometry`.
4. IF OSRM returns a response where `routes` is empty or absent, THEN THE API SHALL treat this as a routing failure and return HTTP 422.
5. THE System SHALL contain no Google Maps SDK imports, no Google Maps API calls, and no Google Maps configuration anywhere in the codebase.

---

### Requirement 7: Weather Sampling

**User Story:** As a logistics operator, I want weather conditions along the entire route to be factored into risk scoring, so that adverse weather anywhere on the journey is captured.

#### Acceptance Criteria

1. WHEN computing weather for a route, THE WeatherSampler SHALL select exactly 5 coordinate points evenly spaced along the `RouteGeometry` coordinate array.
2. WHEN 5 route points have been selected, THE WeatherSampler SHALL call the OpenWeather current weather endpoint for each of the 5 points in parallel.
3. WHEN an OpenWeather response is received for a point, THE WeatherSampler SHALL extract the primary weather condition string from `weather[0].main`.
4. THE WeatherSampler SHALL map weather condition strings to numeric scores using the following table: `"Clear"` → 0, `"Clouds"` → 1, `"Rain"` → 3, `"Thunderstorm"` → 5; any unrecognised condition SHALL be scored as 1.
5. THE WeatherSampler SHALL compute `weatherFactor` as the arithmetic mean of the 5 individual weather scores.
6. IF any individual OpenWeather call fails, THEN THE WeatherSampler SHALL use a score of 1 for that point and SHALL NOT abort the overall weather computation.

---

### Requirement 8: Risk Engine

**User Story:** As a logistics operator, I want risk scores to be computed deterministically from route and weather data, so that scores are reproducible and auditable.

#### Acceptance Criteria

1. THE RiskEngine SHALL compute `riskScore` using the formula: `riskScore = distanceFactor + durationFactor + weatherFactor + urgencyFactor + cargoFactor`.
2. THE RiskEngine SHALL compute `distanceFactor` as `distanceKm * 0.02`.
3. THE RiskEngine SHALL compute `durationFactor` as `durationHours * 0.5`.
4. THE RiskEngine SHALL use the `weatherFactor` value produced by the WeatherSampler.
5. WHEN the time from now until `deadline` is less than 24 hours, THE RiskEngine SHALL set `urgencyFactor` to 5.
6. WHEN the time from now until `deadline` is between 24 hours inclusive and 72 hours exclusive, THE RiskEngine SHALL set `urgencyFactor` to 3.
7. WHEN the time from now until `deadline` is 72 hours or more, THE RiskEngine SHALL set `urgencyFactor` to 1.
8. WHEN `cargoType` is `"fragile"`, THE RiskEngine SHALL set `cargoFactor` to 4.
9. WHEN `cargoType` is not `"fragile"`, THE RiskEngine SHALL set `cargoFactor` to 1.
10. WHEN `riskScore` is greater than 0 and less than or equal to 10, THE RiskEngine SHALL set `riskLevel` to `"Low"`.
11. WHEN `riskScore` is greater than 10 and less than or equal to 20, THE RiskEngine SHALL set `riskLevel` to `"Medium"`.
12. WHEN `riskScore` is greater than 20, THE RiskEngine SHALL set `riskLevel` to `"High"`.
13. THE RiskEngine SHALL NOT use random values, AI output, or any non-deterministic input when computing `riskScore`.

---

### Requirement 9: Gemini AI Explanation

**User Story:** As a logistics operator, I want a human-readable explanation of each shipment's risk profile, so that I can understand the factors driving the risk score without reading raw numbers.

#### Acceptance Criteria

1. WHEN generating an AI explanation, THE API SHALL call Gemini exactly once per shipment, providing a structured summary that includes `distanceKm`, `durationHours`, `weatherFactor`, `riskScore`, `riskLevel`, and `deadline`.
2. IF the Gemini API returns HTTP 429 on the first attempt, THEN THE API SHALL wait 30 seconds and retry the request exactly once.
3. IF the Gemini API fails on both the initial attempt and the retry, THEN THE API SHALL set `aiExplanation` to `"AI explanation unavailable. Showing system-generated reasoning."` and SHALL continue with shipment creation.
4. THE API SHALL NOT call Gemini more than twice per shipment (one initial attempt plus one retry).
5. THE API SHALL NOT block shipment creation on a Gemini failure; the fallback string SHALL be used and the shipment SHALL be saved to MongoDB.

---

### Requirement 10: WebSocket Real-Time Synchronisation

**User Story:** As a logistics operator, I want the shipment list to update in real time without requiring a page refresh, so that I always see the current state of all shipments.

#### Acceptance Criteria

1. THE SocketServer SHALL be initialised once per server process and SHALL expose a single default namespace.
2. WHEN a shipment is successfully written to MongoDB during a `POST /api/shipments` request, THE SocketServer SHALL emit a `shipment_created` event with the full shipment document as the payload.
3. WHEN a shipment is successfully updated in MongoDB during a `PATCH /api/shipments/:id` request, THE SocketServer SHALL emit a `shipment_updated` event with the full updated shipment document as the payload.
4. THE SocketServer SHALL emit events only after the MongoDB write has been confirmed.
5. THE SocketClient SHALL connect to the SocketServer on application load.
6. THE SocketClient SHALL have automatic reconnection enabled.
7. WHEN the SocketClient receives a `shipment_created` event, THE System SHALL add the shipment from the event payload to the local shipment list state without issuing an additional API request.
8. WHEN the SocketClient receives a `shipment_updated` event, THE System SHALL replace the matching shipment in the local shipment list state with the payload from the event without issuing an additional API request.

---

### Requirement 11: GET /api/shipments Endpoint

**User Story:** As a logistics operator, I want to retrieve all shipments from the database, so that I can view the full shipment history on page load.

#### Acceptance Criteria

1. WHEN `GET /api/shipments` is called by an authenticated user, THE API SHALL query MongoDB for all shipment documents, sorted by `createdAt` descending.
2. THE API SHALL return the result in the format `{ "success": true, "data": [ ...shipments ] }`.
3. WHEN `GET /api/shipments` is called without a valid authenticated user, THE API SHALL return HTTP 401.

---

### Requirement 12: PATCH /api/shipments/:id Endpoint

**User Story:** As a logistics operator, I want to update the status of a shipment, so that the system reflects the current state of each delivery.

#### Acceptance Criteria

1. WHEN a valid `PATCH /api/shipments/:id` request is received, THE API SHALL validate the request body with Zod, update the `status` and `updatedAt` fields in MongoDB, emit a `shipment_updated` Socket.io event, and return the updated document.
2. IF the shipment with the given `id` does not exist in MongoDB, THEN THE API SHALL return HTTP 404 with `{ "success": false, "error": "Shipment not found" }`.
3. THE API SHALL update `updatedAt` to the current server timestamp on every successful PATCH operation.

---

### Requirement 13: Firebase Authentication

**User Story:** As a user, I want to sign in with Firebase Auth, so that my session is managed securely without relying on URL parameters or server-side session hacks.

#### Acceptance Criteria

1. THE System SHALL use Firebase Auth as the sole authentication mechanism.
2. THE AuthContext SHALL subscribe to `onAuthStateChanged` and store the resolved user object.
3. WHILE the Firebase Auth state is resolving, THE System SHALL block rendering of protected UI and SHALL display a loading indicator.
4. WHEN the Firebase Auth state resolves to an unauthenticated user, THE System SHALL redirect the user to the sign-in page.
5. THE System SHALL NOT use URL parameters, cookies, or server-side session storage to persist or transmit authentication state.
6. THE System SHALL NOT render protected application pages until `onAuthStateChanged` has fired at least once.

---

### Requirement 14: Frontend Data Flow

**User Story:** As a logistics operator, I want the UI to always reflect the data stored in MongoDB, so that I never see stale, cached, or fabricated data.

#### Acceptance Criteria

1. WHEN the shipment list page loads, THE System SHALL fetch shipment data exclusively from `GET /api/shipments` and SHALL render only the data returned by that endpoint.
2. WHEN a shipment creation form is submitted, THE System SHALL call `POST /api/shipments`, and on a successful response SHALL clear the form fields.
3. WHEN a `shipment_created` Socket.io event is received after form submission, THE System SHALL update the shipment list state from the socket payload.
4. THE System SHALL NOT use optimistic UI updates that add or modify shipment state before an API response or socket event is received.
5. THE System SHALL NOT cache shipment data in a way that causes stale data to be displayed after a page navigation or refresh.
6. THE System SHALL NOT render any hardcoded, static, or mock shipment data in any component or page.
7. WHEN a status update is triggered from the UI, THE System SHALL call `PATCH /api/shipments/:id` and SHALL update the UI only via the resulting `shipment_updated` socket event.

---

### Requirement 15: Codebase Integrity Constraints

**User Story:** As a system architect, I want the codebase to be free of all legacy dependencies and patterns, so that the rebuild is clean and maintainable.

#### Acceptance Criteria

1. THE System SHALL contain no import of `firebase/firestore` or any Firestore SDK module anywhere in the codebase.
2. THE System SHALL contain no import of `@vis.gl/react-google-maps`, `@googlemaps/js-api-loader`, or any Google Maps SDK module anywhere in the codebase.
3. THE System SHALL contain no file that exports mock shipment arrays or static shipment objects used as application data.
4. THE System SHALL use `strict: true` in `tsconfig.json` and SHALL contain no use of the `any` type.
5. THE System SHALL use Zod for all API input validation; manual field-presence checks SHALL NOT be used as the primary validation mechanism.
6. IF a silent failure occurs (an error is caught but neither logged nor surfaced to the caller), THEN THE System SHALL be considered non-compliant with this requirement.
7. THE System SHALL log all caught errors to the server console with sufficient context to identify the failing operation.
