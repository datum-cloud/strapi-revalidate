/**
 * Strapi v5 webhook payload types and the normalized event surfaced to
 * downstream handlers.
 */

/** All webhook event names Strapi v5 emits. */
export type WebhookEventName =
  | 'entry.create'
  | 'entry.update'
  | 'entry.delete'
  | 'entry.publish'
  | 'entry.unpublish'
  | 'media.create'
  | 'media.update'
  | 'media.delete';

/** Raw payload Strapi v5 POSTs to the webhook URL. */
export interface WebhookPayload {
  event: WebhookEventName;
  createdAt: string;
  /** Singular model name, e.g. `"article"`. */
  model: string;
  /** Strapi UID, e.g. `"api::article.article"`. */
  uid: string;
  entry: {
    id?: number;
    documentId?: string;
    slug?: string;
    [key: string]: unknown;
  };
}

/** Normalized event passed to `onRevalidate` after tag resolution. */
export interface WebhookEvent {
  event: WebhookEventName;
  model: string;
  uid: string;
  entryId: string;
  slug?: string;
  /** Cache tags resolved from `uid` (and `slug`, if present). */
  tags: string[];
}

/**
 * Minimal request interface the webhook handler accepts.
 *
 * Designed so an Astro `APIContext.request`, a Next.js `Request`, a
 * SvelteKit `RequestEvent.request`, an Express `req`, and a Node
 * `IncomingMessage` can all satisfy it (after light adapter code in the
 * user's route handler).
 */
export interface WebhookRequest {
  method?: string;
  headers: {
    get?: (name: string) => string | null;
    [key: string]: unknown;
  };
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
}

/**
 * Minimal response interface the webhook handler writes to.
 *
 * The handler always calls `status(code)` first and then `json(body)`. Both
 * calls are independent — `status()`'s return value is ignored — so adapters
 * in framework routes can be a few lines of capture-and-forward.
 */
export interface WebhookResponse {
  status: (code: number) => unknown;
  json: (body: unknown) => void | Promise<void>;
}
