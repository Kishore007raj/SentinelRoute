# Authentication

**Related:** [Security](security.md) · [Deployment](deployment.md) · [Environment](environment.md) · [Back to README](../README.md)

---

## Overview

SentinelRoute uses Firebase Authentication as the sole identity provider. There is no custom session system, no cookies, and no URL-parameter-based authentication.

---

## Client-Side Auth Flow

1. `UserProvider` wraps the entire application at the root layout level and subscribes to `onAuthStateChanged`.
2. While `onAuthStateChanged` is resolving, `AuthContext` exposes `loading: true` and `user: null`.
3. The `(app)/layout.tsx` auth guard blocks rendering of all protected pages until `loading` is `false`.
4. When `loading` is `false` and `user` is `null`, the guard redirects to `/auth/signin`.
5. When `loading` is `false` and `user` is set, the guard proceeds to company status checks.

---

## Company Status Guards

After authentication resolves, `(app)/layout.tsx` checks the company status:

| Company Status | Behavior |
|---|---|
| `loading` | Show spinner -do not render content |
| None (no company) | Redirect to `/company/register` |
| `pending` | Redirect to `/company/pending` |
| `rejected` | Redirect to `/company/rejected` |
| `suspended` | Redirect to `/company/pending` |
| `approved` | Render the app shell |
| `super_admin` | Bypass all company checks |

---

## Server-Side Token Verification

Every protected API route verifies the Firebase ID token from the `Authorization: Bearer <token>` header using the Firebase Admin SDK (`src/lib/firebase-admin.ts`).

```
Authorization: Bearer <Firebase ID Token>
```

The verified token provides the user's `uid`. The API then looks up the `UserRecord` in MongoDB to resolve `companyId` and `role`. These values are derived server-side and cannot be spoofed.

---

## Token Refresh

The `fetchWithAuth` wrapper in `src/lib/store.tsx` handles token expiry:

1. Attach current ID token to the request.
2. If the response is HTTP 401, call `user.getIdToken(true)` to force-refresh the token.
3. Retry the request once with the fresh token.
4. If still HTTP 401, call `handleAuthFailure()` -signs out the user and clears the shipment state.

---

## Seven User Roles

| Role | Level | Description |
|---|---|---|
| `super_admin` | Platform | Full read access across all companies. No mutation on company data. |
| `company_admin` | Company | Full access within their company. Equivalent to owner. |
| `company_manager` | Company | Workforce management + user management. |
| `operations_manager` | Company | Read workforce, view analytics and operational intelligence. |
| `fleet_manager` | Company | Read/write drivers and vehicles. |
| `dispatcher` | Company | Read workforce, create and manage shipments. |
| `driver` | Company | View own profile and own assigned shipments only. |

---

## Firebase Configuration

The Firebase client SDK (`src/lib/firebase.ts`) exports only `auth`. Firestore is not imported or used. All persistent data lives in MongoDB.

The Firebase Admin SDK (`src/lib/firebase-admin.ts`) is initialized as a singleton using `getApps().length === 0` guard to prevent duplicate initialization in Next.js hot-reload.

---

## Sign-In Methods

Firebase Authentication supports:
- Email and password
- Google OAuth sign-in

Both are configured through the Firebase Console. No additional configuration is required in the codebase.
