/**
 * Strapi UID → cache tag mapping.
 *
 * Default rules:
 *  - `api::article.article` → `["articles"]` (+ `article:<slug>` if entry has slug)
 *  - `api::author.author`   → `["authors"]`  (+ `author:<slug>` if entry has slug)
 *  - any other `api::<name>.<name>` → `[<name>]` (+ `<name>:<slug>` if present)
 *
 * Override per-UID via `config.webhook.tagMap` — passing `["foo", "bar"]`
 * replaces the default tag list for that UID (the slug-derived tag is still
 * appended automatically when present).
 */

import type { WebhookPayload } from './types.js';

/** Built-in UID → tag list. */
const DEFAULT_TAG_MAP: Record<string, string[]> = {
  'api::article.article': ['articles'],
  'api::author.author': ['authors'],
};

/**
 * Resolve cache tags for a webhook payload.
 *
 * @param payload - Raw Strapi v5 webhook payload.
 * @param overrides - Optional UID → tag list overrides from config.
 * @returns Deduplicated list of tags to invalidate.
 */
export function mapModelToTags(
  payload: WebhookPayload,
  overrides?: Record<string, string[]>
): string[] {
  const base = overrides?.[payload.uid] ?? DEFAULT_TAG_MAP[payload.uid] ?? [extractModel(payload)];
  const slug = typeof payload.entry?.slug === 'string' ? payload.entry.slug : undefined;
  const tags = slug ? [...base, `${payload.model}:${slug}`] : base;
  return Array.from(new Set(tags));
}

/**
 * Extract the model name from a UID. `api::article.article` → `article`.
 * Falls back to `payload.model` if the UID is in an unexpected shape.
 */
function extractModel(payload: WebhookPayload): string {
  const match = /^api::([^.]+)\./.exec(payload.uid);
  return match?.[1] ?? payload.model;
}
