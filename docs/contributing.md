# Contributing

**Related:** [Development](development.md) · [Testing](testing.md) · [Architecture](architecture.md) · [Back to README](../README.md)

---

## Development Workflow

1. Fork the repository and clone your fork.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the required credentials.
4. Start the development server with `npm run dev`.
5. Run type checking with `npx tsc --noEmit`.
6. Run tests with `npm test`.
7. Run lint with `npm run lint`.

---

## Branch Naming

```
feat/<short-description>        # New feature
fix/<short-description>         # Bug fix
chore/<short-description>       # Dependency updates, tooling, non-functional changes
docs/<short-description>        # Documentation only
refactor/<short-description>    # Code refactor without behavior change
```

---

## Commit Conventions

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

```
feat: add driver suspension cascade to vehicle unassignment
fix: correct weather factor bounds when all points are Clear
chore: upgrade socket.io to 4.8.1
docs: expand module descriptions in README
refactor: extract fetchWithResilience into shared auth helper
```

---

## PR Workflow

1. Open PRs against the `main` branch.
2. PR title must follow the conventional commit format.
3. PR description should include: what changed, why it changed, and how it was tested.
4. All type errors and lint warnings must be resolved before requesting review.
5. Do not amend existing commits in a PR after review has begun -add fixup commits instead.
6. Squash-merge is preferred for feature branches to keep main history clean.

---

## Code Standards

- All types must be defined in or re-exported from `src/lib/types.ts`.
- The `any` type is prohibited. Use `unknown` with type guards where necessary.
- All API inputs must be validated with a Zod schema before any downstream logic.
- Every caught error must be logged with operation context. Silent failures are a bug.
- No module may import from or modify a module below its layer in the dependency graph.
- New MongoDB collections must have `companyId` as the first field in all compound indexes.
- Audit records (`company_audits`, `workforce_audits`, `shipment_timeline`) must remain insert-only. Never add update or delete paths.

---

## Architecture Rules

- New modules must follow the additive pattern: extend existing behavior, never modify completed module files.
- Every new API route must verify the Firebase ID token before accessing MongoDB.
- `companyId` must always be resolved from the server-side `UserRecord` -never from request body, query parameters, or client-provided headers.
- Socket.io events must only be emitted after a confirmed MongoDB write.
