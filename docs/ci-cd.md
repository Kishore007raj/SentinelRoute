# CI/CD

**Related:** [Deployment](deployment.md) · [Testing](testing.md) · [Development](development.md) · [Back to README](../README.md)

---

## GitHub Actions

The CI workflow is defined at `.github/workflows/ci.yml` and runs on every push and pull request to `main`.

**What the workflow runs:**
- `npm run lint` -ESLint across all source files
- `npx tsc --noEmit` -TypeScript type checking with `strict: true`

---

## Running CI Locally

```bash
npm run lint          # ESLint
npx tsc --noEmit      # Type check
npm test              # Vitest single run
```

All three must pass before a PR can be merged.

---

## Branch Protection

The `main` branch should be protected with:
- Require status checks to pass before merging (CI workflow)
- Require pull request reviews
- No force pushes

---

## Future CI Additions

The following are planned for future CI expansion:

- Automated test run (`npm test`) on every push
- Property-based test suite execution
- Lighthouse performance audit on PR previews
- MongoDB memory-server integration test suite
- Automated deployment preview on Vercel for every PR
