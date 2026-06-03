/**
 * Framework-agnostic webhook handler.
 *
 * `createWebhookHandler(config)` returns an `async (req, res) => void`
 * function whose `req` and `res` accept the lowest-common-denominator
 * shapes used by Astro, Next.js (Route Handlers), SvelteKit, Express,
 * and raw Node http. Each framework's docs page in the README shows the
 * single line of glue code needed.
 *
 * Behaviour:
 *  1. 405 if method isn't POST.
 *  2. 401 if a secret is configured and the request's secret doesn't match
 *     (constant-time compare; supports `Authorization: Bearer <secret>`,
 *     `X-Strapi-Signature`, or a raw `strapi-webhook-secret` header).
 *  3. 400 if the body isn't a parseable Strapi v5 webhook payload.
 *  4. Resolves tags via `mapModelToTags`, calls `cache.invalidate(tag)` for
 *     each, and invokes `onRevalidate` if configured.
 *  5. 200 with `{ ok: true, tags }`.
 */

import { timingSafeEqual } from 'node:crypto';
import { createCache } from '../cache/index.js';
import type { CacheManager } from '../cache/manager.js';
import { revalidateConfigSchema } from '../types/config.js';
import type { RevalidateConfig, RevalidateConfigInput } from '../types/config.js';
import { mapModelToTags } from './tags.js';
import type {
  WebhookEvent,
  WebhookPayload,
  WebhookRequest,
  WebhookResponse,
} from './types.js';

/** Async function shape returned by `createWebhookHandler`. */
export type WebhookHandler = (req: WebhookRequest, res: WebhookResponse) => Promise<void>;

/**
 * Build a webhook handler bound to a validated config and the cache
 * manager derived from it.
 *
 * Accepts either a `RevalidateConfigInput` (raw user object — gets validated)
 * or a pair of pre-built dependencies, so power users can share a single
 * `CacheManager` across handlers and content fetchers.
 */
export function createWebhookHandler(input: RevalidateConfigInput): WebhookHandler;
export function createWebhookHandler(deps: {
  config: RevalidateConfig;
  cache: CacheManager;
}): WebhookHandler;
export function createWebhookHandler(
  input: RevalidateConfigInput | { config: RevalidateConfig; cache: CacheManager }
): WebhookHandler {
  const { config, cache } = resolveDeps(input);

  return async function handle(req, res) {
    if (req.method && req.method.toUpperCase() !== 'POST') {
      res.status(405);
      res.json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const configuredSecret = config.webhook?.secret;
    if (configuredSecret) {
      const provided = readSecret(req);
      if (!provided || !constantTimeEqual(provided, configuredSecret)) {
        res.status(401);
        res.json({ ok: false, error: 'Invalid secret' });
        return;
      }
    }

    let payload: WebhookPayload;
    try {
      payload = await readPayload(req);
    } catch (err) {
      res.status(400);
      res.json({
        ok: false,
        error: err instanceof Error ? err.message : 'Bad payload',
      });
      return;
    }

    const tags = mapModelToTags(payload, config.webhook?.tagMap);
    for (const tag of tags) {
      await cache.invalidate(tag);
    }

    const event: WebhookEvent = {
      event: payload.event,
      model: payload.model,
      uid: payload.uid,
      entryId: payload.entry.documentId,
      slug: typeof payload.entry.slug === 'string' ? payload.entry.slug : undefined,
      tags,
    };

    if (config.webhook?.onRevalidate) {
      try {
        await config.webhook.onRevalidate(event);
      } catch (err) {
        // The cache is already invalidated; surface the hook failure to the caller
        // but treat the revalidation itself as successful.
        console.error('[strapi-revalidate] onRevalidate hook threw:', err);
      }
    }

    res.status(200);
    res.json({ ok: true, tags });
  };
}

function resolveDeps(
  input: RevalidateConfigInput | { config: RevalidateConfig; cache: CacheManager }
): { config: RevalidateConfig; cache: CacheManager } {
  if (isPreBuilt(input)) return input;
  const config = revalidateConfigSchema.parse(input);
  const cache = createCache(config);
  return { config, cache };
}

function isPreBuilt(
  value: unknown
): value is { config: RevalidateConfig; cache: CacheManager } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'config' in value &&
    'cache' in value &&
    typeof (value as { cache: unknown }).cache === 'object'
  );
}

function readSecret(req: WebhookRequest): string | null {
  // Headers can arrive as Fetch-style Headers (`.get()`) or as a plain map.
  const direct = headerValue(req, 'authorization');
  if (direct) {
    const match = /^Bearer\s+(.+)$/i.exec(direct);
    if (match) return match[1].trim();
  }

  return (
    headerValue(req, 'x-strapi-signature') ??
    headerValue(req, 'strapi-webhook-secret') ??
    null
  );
}

function headerValue(req: WebhookRequest, name: string): string | null {
  const headers = req.headers;
  if (typeof headers.get === 'function') {
    return headers.get(name);
  }
  const lower = name.toLowerCase();
  const raw = (headers as Record<string, unknown>)[lower] ?? (headers as Record<string, unknown>)[name];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return null;
}

async function readPayload(req: WebhookRequest): Promise<WebhookPayload> {
  let raw: unknown;
  if (typeof req.json === 'function') {
    raw = await req.json();
  } else if (typeof req.text === 'function') {
    const text = await req.text();
    raw = text.length > 0 ? JSON.parse(text) : {};
  } else {
    throw new Error('Request object exposes neither json() nor text()');
  }

  if (!isWebhookPayload(raw)) {
    throw new Error('Payload is not a valid Strapi v5 webhook event');
  }
  return raw;
}

function isWebhookPayload(value: unknown): value is WebhookPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.event !== 'string' || typeof v.model !== 'string' || typeof v.uid !== 'string') {
    return false;
  }
  if (typeof v.entry !== 'object' || v.entry === null) return false;
  const entry = v.entry as Record<string, unknown>;
  return typeof entry.documentId === 'string' || typeof entry.id === 'number';
}

function constantTimeEqual(a: string, b: string): boolean {
  // timingSafeEqual requires equal-length buffers; pad both to the longer length so the
  // length check itself is constant-time-safe (different lengths still return false).
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
