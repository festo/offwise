# 0002: Server-side sessions in Redis

**Status:** Accepted
**Date:** 2026-10-13
**Updated:** 2026-10-14

## Context
The web app needs authenticated sessions for password login now and SSO (OIDC) later. Closing an account or changing a role must take effect immediately. The web app and API are served from the same origin (`/api`). Login and password reset also need brute-force throttling, whose counters are short-lived and should expire on their own instead of accumulating in a table.

## Decision
- **Server-side sessions stored in Redis.** The browser holds only an opaque, random session id in an httpOnly, `Secure` (except in development), `SameSite=Lax` cookie signed with `SESSION_SECRET`. No JWTs for the web app. Integration access (public REST API) will use a separate API-token mechanism.
- Each session is a Redis key with a TTL, so expired sessions disappear without a cleanup job. A per-user set of session ids lets the API end all of a user's sessions at once.
- **Login and password-reset throttling** uses Redis counters with a TTL (`INCR` + `EXPIRE`) in the same Redis instance.
- **Redis persists to disk with AOF** (`appendonly yes`, `appendfsync everysec`), so sessions and throttle windows survive restarts and redeploys.
- **CSRF protection** for every state-changing request (POST, PUT, PATCH, DELETE) on cookie-authenticated routes, following the OWASP CSRF Prevention Cheat Sheet:
  - the request must carry the custom header `X-Requested-With: offwise` (the web client always sends it; we never enable CORS, so cross-origin pages cannot add it without a preflight we refuse);
  - if `Sec-Fetch-Site` is present it must be `same-origin`; if it is absent, `Origin` must equal the origin of `PUBLIC_URL`; if both are absent the request is rejected;
  - `SameSite=Lax` remains as defence in depth, so GET requests must never change state.
- Redis is reached through `REDIS_URL`, a required environment variable.

## Consequences
- Revocation is a key delete: closing an account or resetting a password ends that user's sessions immediately. Every authenticated request loads the user from PostgreSQL, so role changes apply on the next request without touching sessions.
- The Vue app needs no token storage or refresh logic; its API client adds the `X-Requested-With` header to every request.
- Redis is a second datastore to run, persist and back up: the devcontainer and compose files gain a `redis` service with a data volume, and the deployment module must include it.
- Losing the Redis volume signs everyone out and resets throttle windows, but loses no business data; all domain data stays in PostgreSQL.
- E2E tests need a Redis instance and must isolate their keys (a separate logical database or key prefix) from development data.
