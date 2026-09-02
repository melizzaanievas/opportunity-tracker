---
name: TypeScript source tests
description: How API tests should execute TypeScript source in this workspace.
---

Use the workspace `tsx` runner for API tests instead of Node's native type stripping. The API source intentionally uses extensionless local imports for its bundler, which native Node ESM resolution does not resolve when loading TypeScript directly.

**Why:** Native Node test execution failed before any test ran because it could not resolve the existing extensionless local imports.

**How to apply:** Keep source-level API tests on the package's `tsx --test` script and avoid changing production imports solely to accommodate the test runner.
