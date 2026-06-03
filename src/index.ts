/**
 * Package root — re-exports the most commonly used API surface so most
 * consumers can `import { createStrapiRevalidate } from 'strapi-revalidate'`
 * and never touch the subpath imports.
 */

import { createCache } from './cache/index.js';
import type { CacheManager } from './cache/manager.js';
import { createStrapiClient } from './client/index.js';
import type { StrapiClient } from './client/index.js';
import { revalidateConfigSchema } from './types/config.js';
import type { RevalidateConfig, RevalidateConfigInput } from './types/config.js';
import { createWebhookHandler } from './webhook/handler.js';
import type { WebhookHandler } from './webhook/handler.js';

// Subpath re-exports (mirrors the package.json exports map).
export * from './cache/index.js';
export * from './client/index.js';
export * from './content/index.js';
export * from './webhook/index.js';
export * from './types/strapi.js';
export { revalidateConfigSchema } from './types/config.js';
export type {
  RevalidateConfig,
  RevalidateConfigInput,
  CacheDriverName,
  TransportName,
} from './types/config.js';

/** Bundle of objects returned by `createStrapiRevalidate`. */
export interface StrapiRevalidate {
  config: RevalidateConfig;
  client: StrapiClient;
  cache: CacheManager;
  /** Pre-built webhook handler bound to this `client`/`cache` pair. */
  webhook: WebhookHandler;
}

/**
 * One-call factory that validates config, builds the client, cache manager,
 * and webhook handler, and returns them as a single object.
 *
 * @example
 *   const { cache, client, webhook } = createStrapiRevalidate({
 *     url: process.env.STRAPI_URL!,
 *     token: process.env.STRAPI_TOKEN!,
 *     webhook: { secret: process.env.STRAPI_WEBHOOK_SECRET },
 *   });
 */
export function createStrapiRevalidate(input: RevalidateConfigInput): StrapiRevalidate {
  const config = revalidateConfigSchema.parse(input);
  const cache = createCache(config);
  const client = createStrapiClient(config);
  const webhook = createWebhookHandler({ config, cache });
  return { config, client, cache, webhook };
}
