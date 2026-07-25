# Development Guide

**Related:** [Contributing](contributing.md) · [Testing](testing.md) · [Environment](environment.md) · [Project Structure](project-structure.md) · [Back to README](../README.md)

---

## Prerequisites

- Node.js 20+
- npm 10+
- A MongoDB Atlas cluster
- A Firebase project with Authentication enabled
- A Google Gemini API key
- An OpenWeather API key

---

## Local Setup

```bash
# Clone the repository
git clone https://github.com/your-username/sentinelroute.git
cd sentinelroute

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials
```

See [environment.md](environment.md) for the full variable reference.

---

## Running the Development Server

```bash
npm run dev
```

This starts the custom Node.js HTTP server (`tsx server.ts`) which binds the Socket.io server to the same HTTP instance as Next.js. This is required for real-time features in development.

To run Next.js only (no WebSocket):
```bash
npm run dev:next
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Custom Node.js + Socket.io development server |
| `npm run dev:next` | Next.js only (no Socket.io) |
| `npm run build` | Production Next.js build |
| `npm run start` | Production Next.js (serverless) |
| `npm run start:ws` | Production with Socket.io server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest (single pass) |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Type Checking

```bash
npx tsc --noEmit
```

The project uses `strict: true` in `tsconfig.json`. All type errors must be resolved before opening a PR.

---

## Seeding Festival Data

The festival calendar for route risk scoring must be seeded into MongoDB manually:

```bash
npx tsx scripts/seed-festivals.ts
```

This populates the `festivals` collection used by the route analysis pipeline.

---

## Key Development Conventions

- All types live in `src/lib/types.ts`. Never define local types that duplicate centralized ones.
- The `any` type is prohibited. Use `unknown` with type guards.
- All API inputs must be validated with a Zod schema before any downstream logic.
- Every caught error must be logged with operation context. Silent failures are a bug.
- No module may import from or modify a module below its layer in the dependency graph.
- New MongoDB collections must have `companyId` as the first field in all compound indexes.
- Audit collections (`company_audits`, `workforce_audits`, `shipment_timeline`) are insert-only. Never add update or delete paths.
