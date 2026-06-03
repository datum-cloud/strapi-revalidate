/**
 * Public cache surface.
 *
 * `createCache(config)` is the factory most users want — it builds primary
 * and fallback drivers from a `RevalidateConfig` and wraps them in a
 * `CacheManager`. Driver classes and the `CacheDriver` interface are
 * re-exported for users who want to hand-wire a custom topology.
 */

import type { RevalidateConfig } from '../types/config.js';
import { FileCacheDriver } from './drivers/file.js';
import { MemoryCacheDriver } from './drivers/memory.js';
import { RedisCacheDriver } from './drivers/redis.js';
import { CacheManager } from './manager.js';
import type { CacheDriver } from './types.js';

export type { CacheDriver, CacheSetOptions } from './types.js';
export { CacheManager } from './manager.js';
export type { CacheManagerOptions } from './manager.js';
export { FileCacheDriver } from './drivers/file.js';
export type { FileDriverOptions } from './drivers/file.js';
export { MemoryCacheDriver } from './drivers/memory.js';
export { RedisCacheDriver } from './drivers/redis.js';
export type { RedisDriverOptions } from './drivers/redis.js';

/**
 * Build a `CacheManager` from a validated `RevalidateConfig`.
 *
 * The primary driver is whichever was configured (`file` by default); the
 * fallback driver is always a file-backed cache pointed at
 * `config.cache.fallbackDir` so persistence survives process restarts even
 * when the primary is in-memory.
 */
export function createCache(config: RevalidateConfig): CacheManager {
  const primary = buildDriver(config);
  const fallback = new FileCacheDriver({ dir: config.cache.fallbackDir });
  return new CacheManager({
    primary,
    fallback,
    defaultTtl: config.cache.ttl,
    debug: config.debug,
  });
}

function buildDriver(config: RevalidateConfig): CacheDriver {
  const { driver } = config.cache;
  switch (driver) {
    case 'file':
      return new FileCacheDriver({ dir: config.cache.dir });
    case 'memory':
      return new MemoryCacheDriver();
    case 'redis': {
      const redisUrl = config.cache.redisUrl;
      if (!redisUrl) {
        throw new Error('Redis driver requires `cache.redisUrl` to be set.');
      }
      return new RedisCacheDriver({
        redisUrl,
        keyPrefix: config.cache.keyPrefix,
      });
    }
  }
}
