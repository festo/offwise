# 0002: Server-side sessions for web login

**Status:** Accepted
**Date:** 2026-10-13

## Context
The web app needs authenticated sessions for password login now and SSO (OIDC) later. Closing an account or changing a role must take effect immediately. The web app and API are served from the same origin (`/api`).

## Decision
Use server-side sessions stored in PostgreSQL. The browser holds only an opaque session id in an httpOnly, secure, SameSite cookie signed with `SESSION_SECRET`. No JWTs for the web app. Integration access (public REST API) will use a separate API-token mechanism.

## Consequences
- Revocation is a row delete: closing an account or changing a role ends or refreshes sessions immediately.
- The Vue app needs no token storage or refresh logic.
- Every authenticated request reads the session from the DB; acceptable at single-company scale.
- Expired sessions need periodic cleanup.
- State-changing requests need CSRF protection (SameSite cookie plus a check designed in module 1).
