/**
 * Filesystem cache driver.
 *
 * Adapted from datum.net's production `Cache` class. Preserves the original
 * behaviour:
 *  - one `.json` payload file per key
 *  - sibling `.expires` file storing the absolute expiry timestamp (ms)
 *  - empty-file guard: a zero-length cache file is auto-cleared
 *  - ENOENT is silent; other read errors clear the corrupt entry
 *
 * Tag membership is persisted alongside the payload in a sidecar `.tags` file
 * so `deleteByTag` survives process restarts.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CacheDriver, CacheSetOptions } from '../types.js';

const PAYLOAD_EXT = '.json';
const EXPIRES_EXT = '.expires';
const TAGS_EXT = '.tags';

/** Configuration for the file driver. */
export interface FileDriverOptions {
  /** Directory where cache files live. Created on first write. */
  dir: string;
}

/** Filesystem-backed `CacheDriver`. */
export class FileCacheDriver implements CacheDriver {
  private readonly dir: string;

  constructor(options: FileDriverOptions) {
    this.dir = options.dir;
  }

  async get<T>(key: string): Promise<T | null> {
    const filePath = this.payloadPath(key);
    const expiresPath = this.expiresPath(key);

    try {
      const data = await fs.readFile(filePath, 'utf-8');

      // Empty-file guard preserved from datum.net Cache.
      if (!data.trim()) {
        console.warn(`Cache file for key "${key}" is empty, clearing cache`);
        await this.delete(key);
        return null;
      }

      let expirationTime: number | null = null;
      try {
        const expiresData = await fs.readFile(expiresPath, 'utf-8');
        expirationTime = JSON.parse(expiresData) as number;
      } catch {
        // No expires file — treat as no expiry.
      }

      if (expirationTime !== null && Date.now() > expirationTime) {
        await this.delete(key);
        return null;
      }

      return JSON.parse(data) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      console.warn(`Failed to read cache file for key "${key}":`, err);
      await this.delete(key);
      return null;
    }
  }

  async set<T>(key: string, data: T, options: CacheSetOptions = {}): Promise<void> {
    await this.ensureDir();

    const filePath = this.payloadPath(key);
    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');

    if (typeof options.ttl === 'number' && options.ttl > 0) {
      const expirationTime = Date.now() + options.ttl * 1000;
      await fs.writeFile(this.expiresPath(key), JSON.stringify(expirationTime), 'utf-8');
    } else {
      // If a previous entry had an expiry, remove it so the new entry is treated as permanent.
      await this.silentUnlink(this.expiresPath(key));
    }

    if (options.tags && options.tags.length > 0) {
      await fs.writeFile(this.tagsPath(key), JSON.stringify(options.tags), 'utf-8');
    } else {
      await this.silentUnlink(this.tagsPath(key));
    }
  }

  async delete(key: string): Promise<void> {
    await Promise.all([
      this.silentUnlink(this.payloadPath(key)),
      this.silentUnlink(this.expiresPath(key)),
      this.silentUnlink(this.tagsPath(key)),
    ]);
  }

  async deleteByTag(tag: string): Promise<void> {
    const keys = await this.keys();
    await Promise.all(
      keys.map(async (key) => {
        const tags = await this.readTags(key);
        if (tags.includes(tag)) {
          await this.delete(key);
        }
      })
    );
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.dir);
      await Promise.all(files.map((file) => this.silentUnlink(path.join(this.dir, file))));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async keys(prefix?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dir);
      const keys = files
        .filter((file) => file.endsWith(PAYLOAD_EXT))
        .map((file) => path.basename(file, PAYLOAD_EXT));
      return prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  private payloadPath(key: string): string {
    return path.join(this.dir, `${key}${PAYLOAD_EXT}`);
  }

  private expiresPath(key: string): string {
    return path.join(this.dir, `${key}${EXPIRES_EXT}`);
  }

  private tagsPath(key: string): string {
    return path.join(this.dir, `${key}${TAGS_EXT}`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private async readTags(key: string): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.tagsPath(key), 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
    } catch {
      return [];
    }
  }

  private async silentUnlink(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // ENOENT and similar — ignore.
    }
  }
}
