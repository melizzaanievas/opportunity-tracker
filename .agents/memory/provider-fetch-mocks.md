---
name: Provider fetch mocks
description: How to isolate third-party HTTP calls without bypassing the app under test
---

When an integration test stubs the global fetch implementation for a provider, it must only handle requests addressed to that provider and delegate all other requests to the original fetch.

**Why:** The same process uses fetch for both the local HTTP server under test and the provider API. A broad stub intercepts the test request before Express receives it, producing misleading route failures.

**How to apply:** Capture the original fetch, branch on the provider URL prefix, and restore it in a `finally` block around the test.