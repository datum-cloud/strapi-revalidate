/**
 * In-memory cache driver.
 *
 * Intended for development, testing, and short-lived serverless functions
 * where process restarts naturally evict the cache. Not suitable for
 * multi-instance deployments — use the redis driver for that.
 */

import type { CacheDriver, CacheSetOptions } from '../types.js';

interface MemoryEntry {
  /** Stored payload (typed as `unknown` so `get<T>` can cast). */
  data: unknown;
  /** Absolute expiry timestamp in ms, or `null` for no expiry. */
  expiresAt: number | null;
  /** Tags associated with the entry. */
  tags: Set<string>;
}

/** Map-based in-memory `CacheDriver`. */
export class MemoryCacheDriver implements CacheDriver {
  private readonly store = new Map<string, MemoryEntry>();
  private readonly tagIndex = new Map<string, Set<string>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return null;
    }

    return entry.data as T;
  }

  async set<T>(key: string, data: T, options: CacheSetOptions = {}): Promise<void> {
    // Detach old tags first so reassignments don't leak.
    const previous = this.store.get(key);
    if (previous) {
      for (const tag of previous.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }

    const expiresAt =
      typeof options.ttl === 'number' && options.ttl > 0 ? Date.now() + options.ttl * 1000 : null;
    const tags = new Set(options.tags ?? []);

    this.store.set(key, { data, expiresAt, tags });

    for (const tag of tags) {
      let bucket = this.tagIndex.get(tag);
      if (!bucket) {
        bucket = new Set();
        this.tagIndex.set(tag, bucket);
      }
      bucket.add(key);
    }
  }

  async delete(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (!entry) return;

    for (const tag of entry.tags) {
      const bucket = this.tagIndex.get(tag);
      if (bucket) {
        bucket.delete(key);
        if (bucket.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
    this.store.delete(key);
  }

  async deleteByTag(tag: string): Promise<void> {
    const bucket = this.tagIndex.get(tag);
    if (!bucket) return;
    // Materialize before iterating — delete() mutates the bucket.
    const keys = Array.from(bucket);
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.tagIndex.clear();
  }

  async keys(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.store.keys());
    return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  }
}
