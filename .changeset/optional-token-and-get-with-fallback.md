---
"@datum-cloud/strapi-revalidate": minor
---

Make `token` optional and add `CacheManager.getWithFallback()`

**Optional token**

`token` is now optional in both `revalidateConfigSchema` and `GraphQLClientOptions`.
When omitted, the `Authorization` header is not sent — useful for Strapi instances
where queried content is publicly readable without a token.

Previously the package required a non-empty token, forcing consumers to pass a
placeholder string that caused Strapi to return 401 even on public endpoints.

**`CacheManager.getWithFallback(key, fetcher, options?)`**

Implements the read pattern described in the class JSDoc but never shipped:
primary hit → fetcher → fallback. On a primary miss the fetcher is called; a
successful result is written to both caches before being returned. If the fetcher
returns `null`, the persistent fallback cache is read instead, so a Strapi outage
serves last-known-good data rather than an empty page.
