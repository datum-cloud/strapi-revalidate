---
'@datum-cloud/strapi-revalidate': minor
---

Propagate webhook warm failures, improve tag mapping, and export event helpers

- Add `webhook.failOnWarmError` (default `true`) so `onRevalidate` errors return HTTP 502 with `{ ok: false, invalidated: true }` instead of a silent 200
- Export `buildWebhookEvent()` and `resolveEntryId()` for consumer warm hooks
- Accept `X-Webhook-Secret` in addition to existing auth headers
- Invalidate slug tags for `previousSlug`, `oldSlug`, and `previous_slug` entry fields on rename
- Fix `entryId` when webhooks only include numeric `entry.id`
