---
name: Telegram webhook inspection
description: The Telegram Bot API limitation relevant to live webhook drift checks
---

Telegram's `getWebhookInfo` response does not include the configured `secret_token`. Live checks can compare the webhook URL and other observable settings such as allowed updates, while separately reporting whether the app has a secret configured; they must not claim the secret was verified.

**Why:** The secret is write-only through the Bot API, so treating a matching URL as proof of a matching secret would create a false security signal.

**How to apply:** Keep secret values out of health output and diagnostics, and describe any live secret check as unavailable rather than attempting to infer it from the webhook info response.