/**
 * Strapi UID → cache tag mapping.
 *
 * Default rules:
 *  - `api::article.article` → `["articles"]` (+ `article:<slug>` if entry has slug)
 *  - `api::author.author`   → `["authors"]`  (+ `author:<slug>` if entry has slug)
 *  - any other `api::<name>.<name>` → `[<name>]` (+ `<name>:<slug>` if present)
 *
 * Slug-derived tags include the current slug and optional prior slugs when the
 * webhook entry carries `previousSlug`, `oldSlug`, or `previous_slug` (e.g. from
 * a Strapi lifecycle that records the value before a rename).
 *
 * Override per-UID via `config.webhook.tagMap` — passing `["foo", "bar"]`
 * replaces the default tag list for that UID (slug-derived tags are still
 * appended automatically when present).
 */

import type { WebhookPayload } from './types.js';

/** Built-in UID → tag list. */
const DEFAULT_TAG_MAP: Record<string, string[]> = {
  'api::article.article': ['articles'],
  'api::author.author': ['authors'],
};

/** Optional entry fields that may carry a slug from before a rename. */
const PREVIOUS_SLUG_KEYS = ['previousSlug', 'oldSlug', 'previous_slug'] as const;

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
  const slugTags = collectSlugTags(payload);
  return Array.from(new Set([...base, ...slugTags]));
}

function collectSlugTags(payload: WebhookPayload): string[] {
  const slugs = new Set<string>();
  const entry = payload.entry;

  if (typeof entry.slug === 'string' && entry.slug.length > 0) {
    slugs.add(entry.slug);
  }

  for (const key of PREVIOUS_SLUG_KEYS) {
    const value = entry[key];
    if (typeof value === 'string' && value.length > 0) {
      slugs.add(value);
    }
  }

  return Array.from(slugs).map((slug) => `${payload.model}:${slug}`);
}

/**
 * Extract the model name from a UID. `api::article.article` → `article`.
 * Falls back to `payload.model` if the UID is in an unexpected shape.
 */
function extractModel(payload: WebhookPayload): string {
  const match = /^api::([^.]+)\./.exec(payload.uid);
  return match?.[1] ?? payload.model;
}
