---
name: Artifact build variables
description: Required environment variables for standalone Vite artifact builds.
---

Standalone Vite builds in this workspace require the artifact's configured `PORT` and `BASE_PATH` values from its artifact configuration; workflow startup supplies them automatically.

**Why:** Running the package build directly without those variables fails while loading the Vite config, even when the application code is valid.

**How to apply:** When manually invoking a frontend production build, provide the artifact-specific values before running the package build.