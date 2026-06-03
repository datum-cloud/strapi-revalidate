/**
 * Cache driver contract.
 *
 * Implementations are responsible for storage details (filesystem, in-memory
 * Map, Redis, etc.). The `CacheManager` layered above provides tag tracking
 * and fallback semantics so drivers stay simple.
 */

/** Options accepted by `CacheDriver.set`. */
export interface CacheSetOptions {
  /** Time-to-live in **seconds**. Omit for no expiry. */
  ttl?: number;
  /** Tag names associated with this key. Drivers may persist these to support `deleteByTag`. */
  tags?: string[];
}

/**
 * Storage-agnostic cache contract. All public cache APIs accept anything
 * that satisfies this interface.
 */
export interface CacheDriver {
  /** Returns the cached value for `key`, or `null` if missing or expired. */
  get<T>(key: string): Promise<T | null>;

  /** Stores `data` under `key` with optional ttl (seconds) and tag list. */
  set<T>(key: string, data: T, options?: CacheSetOptions): Promise<void>;

  /** Removes a single key. No-op if absent. */
  delete(key: string): Promise<void>;

  /** Removes every key associated with `tag`. */
  deleteByTag(tag: string): Promise<void>;

  /** Removes every key managed by this driver. */
  clear(): Promise<void>;

  /** Lists all keys, optionally filtered by a string prefix. */
  keys(prefix?: string): Promise<string[]>;
}
