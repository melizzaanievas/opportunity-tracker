---
name: Workspace package installation targeting
description: Package installation behavior for dependencies that belong to a single pnpm workspace artifact.
---

When adding a JavaScript dependency to one workspace artifact, target that package explicitly instead of allowing the installer to add it at the workspace root.

**Why:** The generic package installer can resolve the package correctly but fail its root-package safety check, leaving the intended artifact unchanged.

**How to apply:** Use the artifact-scoped pnpm filter when the dependency belongs to one app, then verify both that app's package manifest and the workspace lockfile.