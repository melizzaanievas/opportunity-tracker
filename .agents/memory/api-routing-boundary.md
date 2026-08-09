---
name: API routing boundary
description: The app uses a separate Express API artifact alongside a static frontend, so automation endpoints must be handled before any frontend rewrite.
---

Public automation endpoints should be registered on the Express app before the `/api` router and any frontend fallback. The API service is separate from the React artifact; frontend rewrites can otherwise turn an API request into an HTML client-side 404.

**Why:** External cron and webhook callers need a direct JSON response and do not carry dashboard session cookies.

**How to apply:** Mount public GET automation routes at the API app boundary, keep dashboard mutations authenticated, and return JSON for unmatched `/api/*` paths instead of allowing them to fall through to the frontend.