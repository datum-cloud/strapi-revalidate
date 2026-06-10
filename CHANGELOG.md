# @datum-cloud/strapi-revalidate

## 0.2.0

### Minor Changes

- 632d366: Make `token` optional and add `CacheManager.getWithFallback()`

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

## 0.1.2

### Patch Changes

- bb2e068: Inline TypeScript sources into emitted `dist/*.js.map` files via `inlineSources: true` in `tsconfig.json`. Downstream bundlers (Vite, esbuild) were warning on every consumer load because the published tarball ships `dist/` only, while the maps' `sources` field pointed at `../src/*.ts` paths that don't exist post-install. Maps are now self-contained — bundlers stop warning, and DevTools / stack traces still resolve to the original TypeScript source.
