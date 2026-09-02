---
name: GitHub connector write limits
description: Connector behavior to account for when exporting a large local repository snapshot to GitHub.
---

Authenticated GitHub connector reads may continue working while sustained blob uploads or tree writes are rate-limited or blocked by the connector’s Cloudflare layer.

**Why:** Large snapshot exports can fail after many individually valid writes, leaving only orphaned Git objects and no branch update.

**How to apply:** Prefer the secure workspace `GIT_URL` secret and a normal non-force `git push` for large exports. If the connector API must be used, keep requests sparse and verify the branch ref and resulting tree after every export.