/**
 * Public client surface.
 *
 * `createStrapiClient(config)` picks the right transport (graphql today,
 * rest later) and returns a unified `StrapiClient`. All built-in content
 * fetchers receive a client through their `fetch*` helpers rather than
 * instantiating one themselves — so the same connection, timeout, and
 * retry policy applies across the package.
 */

import type { RevalidateConfig } from '../types/config.js';
import { GraphQLStrapiClient } from './graphql.js';
import { createRestClient } from './rest.js';

export { GraphQLStrapiClient } from './graphql.js';
export type { GraphQLClientOptions, GraphQLResponse } from './graphql.js';
export { createRestClient, RestStrapiClient } from './rest.js';
export type { RestClientOptions } from './rest.js';

/**
 * Anything the package's content fetchers know how to talk to.
 *
 * Today this is exclusively the GraphQL client; the REST stub is planned
 * to satisfy the same shape via a `query`-style adapter in a future release.
 */
export type StrapiClient = GraphQLStrapiClient;

/**
 * Build a `StrapiClient` from a validated `RevalidateConfig`. Throws
 * `Error` if the configured transport isn't implemented yet (REST).
 */
export function createStrapiClient(config: RevalidateConfig): StrapiClient {
  if (config.transport === 'rest') {
    // Surfaced via the stub for a consistent error message.
    createRestClient({
      url: config.url,
      token: config.token,
      timeout: config.timeout,
      retry: config.retry,
    });
    // Unreachable — createRestClient throws — but keeps the return type honest.
    throw new Error('REST transport not yet implemented');
  }

  return new GraphQLStrapiClient({
    url: config.url,
    token: config.token,
    timeout: config.timeout,
    retry: config.retry,
    debug: config.debug,
  });
}
