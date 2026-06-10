/**
 * GraphQL transport for Strapi v5.
 *
 * Adapted from datum.net's `graphqlQuery()` with two additions: configurable
 * retry with exponential backoff, and a structured `StrapiClient` surface so
 * the same instance is reused across fetchers (no module-level state).
 */

/** Generic Strapi GraphQL response envelope. */
export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

/** Configuration for a `GraphQLStrapiClient`. */
export interface GraphQLClientOptions {
  /** Strapi base URL (no trailing `/graphql`). */
  url: string;
  /**
   * Strapi API token. Sent as `Authorization: Bearer <token>` when present.
   * Omit for Strapi instances where the queried content is publicly readable.
   */
  token?: string;
  /** Per-request timeout in **milliseconds**. */
  timeout: number;
  /** Number of retries on transport failure (timeout, network, 5xx). 0 disables retry. */
  retry: number;
  /** When true, logs request lifecycle via `console.debug`. */
  debug?: boolean;
}

/**
 * Strapi GraphQL client.
 *
 * `query<T>()` returns the unwrapped `data` payload or `null` on failure;
 * callers are expected to treat `null` as "Strapi unreachable / invalid"
 * and fall back to stale cache.
 */
export class GraphQLStrapiClient {
  private readonly options: GraphQLClientOptions;

  constructor(options: GraphQLClientOptions) {
    this.options = options;
  }

  /**
   * Execute a GraphQL operation. Returns the `data` payload on success,
   * `null` if the server returns an error envelope, a non-2xx status,
   * times out, or all retries are exhausted.
   */
  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
    const { retry } = this.options;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const result = await this.executeOnce<T>(query, variables);
        if (result !== null) return result;
        // result === null means a structured Strapi error (4xx / GraphQL errors).
        // Don't retry those — they won't get better.
        return null;
      } catch (err) {
        lastError = err;
        if (this.options.debug) {
          console.debug(
            `[strapi-revalidate] graphql attempt ${attempt + 1}/${retry + 1} failed:`,
            err
          );
        }
        if (attempt < retry) {
          await sleep(backoffMs(attempt));
        }
      }
    }

    if (lastError instanceof Error && lastError.name === 'AbortError') {
      console.error(`Strapi request timed out after ${this.options.timeout}ms`);
    } else if (lastError) {
      console.error('Error fetching from Strapi:', lastError);
    }
    return null;
  }

  private async executeOnce<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(`${this.options.url.replace(/\/$/, '')}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.options.token ? { Authorization: `Bearer ${this.options.token}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Strapi GraphQL error: ${response.status} ${response.statusText}`, text);
        // 5xx is retryable — surface as a thrown error so the retry loop fires.
        if (response.status >= 500) {
          throw new Error(`Strapi ${response.status} ${response.statusText}`);
        }
        return null;
      }

      const result = (await response.json()) as GraphQLResponse<T>;

      if (result.errors && result.errors.length > 0) {
        console.error('Strapi GraphQL errors:', result.errors);
        return null;
      }

      return result.data;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with a sane cap. Attempt is 0-indexed. */
function backoffMs(attempt: number): number {
  const base = 200 * 2 ** attempt;
  return Math.min(base, 2000);
}
