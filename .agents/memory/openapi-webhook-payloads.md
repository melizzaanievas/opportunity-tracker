---
name: OpenAPI webhook payloads
description: Codegen-safe pattern for webhook request bodies in this workspace.
---

Use a named OpenAPI component reference for webhook request bodies instead of an inline object schema when the endpoint operation has a generated body name.

**Why:** Orval can emit both an operation-level Zod body schema and a TypeScript type with the same generated name, which makes the package barrel export fail.

**How to apply:** Add a reusable payload component under components.schemas and reference it from the path operation, then regenerate the API client and Zod package.