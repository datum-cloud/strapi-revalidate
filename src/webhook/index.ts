/**
 * Public webhook surface — re-exports for the `strapi-revalidate/webhook`
 * subpath.
 */

export { createWebhookHandler } from './handler.js';
export type { WebhookHandler } from './handler.js';
export { buildWebhookEvent, resolveEntryId } from './event.js';
export { mapModelToTags } from './tags.js';
export type {
  WebhookEvent,
  WebhookEventName,
  WebhookPayload,
  WebhookRequest,
  WebhookResponse,
} from './types.js';
