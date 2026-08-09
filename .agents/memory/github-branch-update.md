---
name: GitHub branch update behavior
description: The connected Git push helper may report BRANCH_ALREADY_EXISTS when updating an existing GitHub branch.
---

When a connected GitHub push reports `BRANCH_ALREADY_EXISTS` for an existing branch, use the authenticated GitHub connection to update the branch reference after ensuring the target commit or tree exists on GitHub.

**Why:** The helper attempted branch creation instead of updating the existing `main` branch, while the GitHub REST ref update worked once its commit object was available remotely.

**How to apply:** Preserve the desired branch history, upload missing Git objects through the connected GitHub API when needed, update `refs/heads/<branch>` without force when ancestry allows it, and verify the resulting remote SHA.