/**
 * Helpers for normalizing Strapi webhook payloads into {@link WebhookEvent}.
 */

import type { WebhookEvent, WebhookPayload } from './types.js';

/**
 * Resolve a stable entry identifier from a webhook entry payload.
 * Strapi v5 usually sends `documentId`; older payloads may only include numeric `id`.
 */
export function resolveEntryId(entry: WebhookPayload['entry']): string {
  if (typeof entry.documentId === 'string') return entry.documentId;
  if (typeof entry.id === 'number') return String(entry.id);
  return '';
}

/**
 * Build the normalized event passed to `onRevalidate` after tag resolution.
 */
export function buildWebhookEvent(payload: WebhookPayload, tags: string[]): WebhookEvent {
  return {
    event: payload.event,
    model: payload.model,
    uid: payload.uid,
    entryId: resolveEntryId(payload.entry),
    slug: typeof payload.entry.slug === 'string' ? payload.entry.slug : undefined,
    tags,
  };
}
