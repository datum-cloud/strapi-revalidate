/**
 * CacheManager — the composition layer the public API talks to.
 *
 * Responsibilities:
 *  - Track tag membership across writes so `invalidate(tag)` is O(tagged keys).
 *  - Mirror every successful `set()` to a persistent fallback driver with no
 *    TTL, so Strapi outages don't take the site down.
 *  - `getWithFallback()` for resilient read paths: primary hit → fetcher →
 *    fallback, with a single cache write on fresh data.
 *
 * Drivers themselves stay storage-only; tag accounting lives here.
 */

import type { CacheDriver, CacheSetOptions } from './types.js';

/** Options for instantiating a `CacheManager`. */
export interface CacheManagerOptions {
  /** Primary driver — honours TTL, serves hot reads. */
  primary: CacheDriver;
  /** Persistent fallback driver — never expires, written on every successful set. */
  fallback: CacheDriver;
  /** Default TTL (seconds) applied when `set` is called without one. */
  defaultTtl?: number;
  /** When true, hits/misses are logged via `console.debug`. */
  debug?: boolean;
}

/**
 * Cache facade. All content fetchers and the webhook handler talk to this,
 * not to a driver directly.
 */
export class CacheManager {
  private readonly primary: CacheDriver;
  private readonly fallback: CacheDriver;
  private readonly defaultTtl: number;
  private readonly debug: boolean;

  constructor(options: CacheManagerOptions) {
    this.primary = options.primary;
    this.fallback = options.fallback;
    this.defaultTtl = options.defaultTtl ?? 3600;
    this.debug = options.debug ?? false;
  }

  /** Read from the primary cache. Returns `null` on miss or expiry. */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.primary.get<T>(key);
    if (this.debug) {
      console.debug(`[strapi-revalidate] cache ${value === null ? 'MISS' : 'HIT'} → ${key}`);
    }
    return value;
  }

  /** Read from the persistent fallback cache. Returns `null` if never populated. */
  async getFallback<T>(key: string): Promise<T | null> {
    return this.fallback.get<T>(key);
  }

  /**
   * Full read path with outage resilience:
   * 1. Return the primary cache value if present.
   * 2. Call `fetcher()` to get fresh data.
   * 3. On success, write to both primary and fallback caches, then return.
   * 4. On failure (`null`), return whatever the fallback cache holds.
   *
   * @param key     Cache key.
   * @param fetcher Async function that fetches fresh data. Return `null` to
   *                signal failure and trigger the fallback read.
   * @param options TTL and tag options forwarded to `set()` on a fresh write.
   */
  async getWithFallback<T>(
    key: string,
    fetcher: () => Promise<T | null>,
    options: CacheSetOptions = {}
  ): Promise<T | null> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    if (fresh !== null) {
      await this.set(key, fresh, options);
      return fresh;
    }

    if (this.debug) {
      console.debug(`[strapi-revalidate] fetcher returned null, reading fallback → ${key}`);
    }
    return this.getFallback<T>(key);
  }

  /**
   * Write to both the primary cache (with TTL + tags) and the fallback cache
   * (no TTL, no tags). Tag accounting happens at the driver level.
   */
  async set<T>(key: string, data: T, options: CacheSetOptions = {}): Promise<void> {
    const ttl = options.ttl ?? this.defaultTtl;
    await this.primary.set(key, data, { ttl, tags: options.tags });
    // Fallback: no TTL, no tag indexing — it exists purely to survive outages.
    await this.fallback.set(key, data);
  }

  /** Remove a single key from the primary cache. Fallback is preserved by design. */
  async delete(key: string): Promise<void> {
    await this.primary.delete(key);
  }

  /**
   * Invalidate every primary-cache key associated with `tag`. The fallback
   * cache is intentionally untouched — if the upcoming refetch fails, stale
   * data should still serve.
   */
  async invalidate(tag: string): Promise<void> {
    await this.primary.deleteByTag(tag);
    if (this.debug) {
      console.debug(`[strapi-revalidate] invalidated tag → ${tag}`);
    }
  }

  /** Invalidate all primary-cache entries. Fallback is preserved. */
  async invalidateAll(): Promise<void> {
    await this.primary.clear();
    if (this.debug) {
      console.debug('[strapi-revalidate] invalidated all');
    }
  }
}
