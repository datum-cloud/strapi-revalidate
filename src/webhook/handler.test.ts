import { describe, expect, it } from 'vitest';
import { MemoryCacheDriver } from '../cache/drivers/memory.js';
import { CacheManager } from '../cache/manager.js';
import { revalidateConfigSchema } from '../types/config.js';
import { buildWebhookEvent, resolveEntryId } from './event.js';
import { createWebhookHandler } from './handler.js';
import { mapModelToTags } from './tags.js';
import type { WebhookPayload, WebhookRequest } from './types.js';

const BASE_PAYLOAD: WebhookPayload = {
  event: 'entry.update',
  createdAt: '2026-06-16T00:00:00.000Z',
  model: 'article',
  uid: 'api::article.article',
  entry: {
    documentId: 'doc-1',
    slug: 'new-slug',
  },
};

function makeHandler(options?: {
  onRevalidate?: (event: unknown) => void | Promise<void>;
  failOnWarmError?: boolean;
}) {
  const config = revalidateConfigSchema.parse({
    url: 'https://cms.example.com',
    webhook: {
      secret: 'test-secret',
      onRevalidate: options?.onRevalidate,
      failOnWarmError: options?.failOnWarmError,
    },
    cache: { driver: 'memory' as const },
  });

  const cache = new CacheManager({
    primary: new MemoryCacheDriver(),
    fallback: new MemoryCacheDriver(),
    defaultTtl: 3600,
  });

  return createWebhookHandler({ config, cache });
}

function makeRequest(
  payload: WebhookPayload,
  headers: Record<string, string> = { 'strapi-webhook-secret': 'test-secret' }
): WebhookRequest {
  return {
    method: 'POST',
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null,
    },
    json: async () => payload,
  };
}

async function invoke(
  handler: ReturnType<typeof makeHandler>,
  req: WebhookRequest
): Promise<{ status: number; body: Record<string, unknown> }> {
  let status = 0;
  let body: unknown;

  await handler(req, {
    status: (code) => {
      status = code;
    },
    json: (value) => {
      body = value;
    },
  });

  return { status, body: body as Record<string, unknown> };
}

describe('resolveEntryId', () => {
  it('prefers documentId', () => {
    expect(resolveEntryId({ documentId: 'doc-1', id: 42 })).toBe('doc-1');
  });

  it('falls back to numeric id', () => {
    expect(resolveEntryId({ id: 42 })).toBe('42');
  });
});

describe('buildWebhookEvent', () => {
  it('normalizes payload and tags', () => {
    const event = buildWebhookEvent(BASE_PAYLOAD, ['articles', 'article:new-slug']);
    expect(event.entryId).toBe('doc-1');
    expect(event.slug).toBe('new-slug');
    expect(event.tags).toEqual(['articles', 'article:new-slug']);
  });
});

describe('mapModelToTags', () => {
  it('includes current and previous slug tags', () => {
    const tags = mapModelToTags({
      ...BASE_PAYLOAD,
      entry: {
        documentId: 'doc-1',
        slug: 'new-slug',
        previousSlug: 'old-slug',
      },
    });

    expect(tags).toEqual(['articles', 'article:new-slug', 'article:old-slug']);
  });
});

describe('createWebhookHandler', () => {
  it('accepts X-Webhook-Secret header', async () => {
    const handler = makeHandler();
    const result = await invoke(
      handler,
      makeRequest(BASE_PAYLOAD, { 'x-webhook-secret': 'test-secret' })
    );

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
  });

  it('returns 502 when onRevalidate throws and failOnWarmError is true', async () => {
    const handler = makeHandler({
      onRevalidate: async () => {
        throw new Error('Strapi timeout');
      },
      failOnWarmError: true,
    });

    const result = await invoke(handler, makeRequest(BASE_PAYLOAD));

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      ok: false,
      invalidated: true,
      error: 'Cache warm failed',
      message: 'Strapi timeout',
      tags: ['articles', 'article:new-slug'],
    });
  });

  it('returns 200 when onRevalidate throws and failOnWarmError is false', async () => {
    const handler = makeHandler({
      onRevalidate: async () => {
        throw new Error('Strapi timeout');
      },
      failOnWarmError: false,
    });

    const result = await invoke(handler, makeRequest(BASE_PAYLOAD));

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
  });
});
