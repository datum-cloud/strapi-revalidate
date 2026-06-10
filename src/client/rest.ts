/**
 * REST transport for Strapi — STUB.
 *
 * The interface is exported for forward compatibility; runtime usage throws
 * a clear error. v0.1.0 only ships the GraphQL transport because every
 * built-in content fetcher uses GraphQL.
 */

/** Configuration for the (not-yet-implemented) REST client. */
export interface RestClientOptions {
  url: string;
  token?: string;
  timeout: number;
  retry: number;
}

const NOT_IMPLEMENTED_MESSAGE =
  'REST transport not yet implemented. Use transport: "graphql" or pin to a future v1.x release.';

/** Stubbed REST client. Constructor is callable so config typing works; all reads throw. */
export class RestStrapiClient {
  // Stored to keep strict property init quiet and document intent.
  private readonly options: RestClientOptions;

  constructor(options: RestClientOptions) {
    this.options = options;
  }

  async get<T>(_path: string, _params?: Record<string, unknown>): Promise<T | null> {
    void this.options;
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }
}

/** Factory that mirrors `createStrapiClient` shape. Throws on first use. */
export function createRestClient(_options: RestClientOptions): RestStrapiClient {
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}
