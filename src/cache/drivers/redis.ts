/**
 * Redis cache driver — STUB.
 *
 * The interface is exported so config typing and exports stay stable.
 * Actual ioredis-backed implementation is planned for v1.x; consumers
 * that try to instantiate this driver will get a clear runtime error.
 */

import type { CacheDriver, CacheSetOptions } from '../types.js';

/** Configuration for the (not-yet-implemented) Redis driver. */
export interface RedisDriverOptions {
  redisUrl: string;
  keyPrefix?: string;
}

const NOT_IMPLEMENTED_MESSAGE =
  'Redis driver: not implemented in v0.1.0. Install ioredis and use file/memory driver, or wait for v1.x.';

/** Stubbed Redis `CacheDriver`. Every method throws. */
export class RedisCacheDriver implements CacheDriver {
  // Stored to satisfy strict property init while keeping the stub honest.
  private readonly options: RedisDriverOptions;

  constructor(options: RedisDriverOptions) {
    this.options = options;
  }

  async get<T>(_key: string): Promise<T | null> {
    void this.options;
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async set<T>(_key: string, _data: T, _options?: CacheSetOptions): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async delete(_key: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async deleteByTag(_tag: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async clear(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async keys(_prefix?: string): Promise<string[]> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }
}
