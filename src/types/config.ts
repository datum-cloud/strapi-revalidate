/**
 * Runtime configuration schema for strapi-revalidate.
 *
 * Validated with zod so misconfigurations surface at startup rather than
 * at the first cache miss or webhook delivery.
 */

import { z } from 'zod';
import type { WebhookEvent } from '../webhook/types.js';

/** Supported cache driver identifiers. */
export const cacheDriverNameSchema = z.enum(['file', 'memory', 'redis']);
export type CacheDriverName = z.infer<typeof cacheDriverNameSchema>;

/** Supported transport identifiers for the Strapi client. */
export const transportNameSchema = z.enum(['graphql', 'rest']);
export type TransportName = z.infer<typeof transportNameSchema>;

const cacheConfigSchema = z
  .object({
    driver: cacheDriverNameSchema.default('file'),
    ttl: z.number().int().positive().default(3600),
    dir: z.string().default('.cache/strapi-revalidate'),
    fallbackDir: z.string().default('.cache/strapi-fallback'),
    redisUrl: z.string().url().optional(),
    keyPrefix: z.string().optional(),
  })
  .default({});

const webhookConfigSchema = z
  .object({
    secret: z.string().optional(),
    tagMap: z.record(z.array(z.string())).optional(),
    onRevalidate: z
      .function()
      .args(z.custom<WebhookEvent>())
      .returns(z.union([z.void(), z.promise(z.void())]))
      .optional(),
  })
  .optional();

/**
 * Full runtime configuration schema.
 *
 * Use `revalidateConfigSchema.parse(input)` to validate user input and
 * apply defaults in one step.
 */
export const revalidateConfigSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
  webhook: webhookConfigSchema,
  cache: cacheConfigSchema,
  transport: transportNameSchema.default('graphql'),
  timeout: z.number().int().positive().default(3000),
  retry: z.number().int().min(0).default(2),
  debug: z.boolean().default(false),
});

/** User-supplied configuration (pre-validation). */
export type RevalidateConfigInput = z.input<typeof revalidateConfigSchema>;

/** Validated, defaults-applied configuration. */
export type RevalidateConfig = z.output<typeof revalidateConfigSchema>;
