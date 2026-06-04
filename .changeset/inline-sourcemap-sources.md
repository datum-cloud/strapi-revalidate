---
'@datum-cloud/strapi-revalidate': patch
---

Inline TypeScript sources into emitted `dist/*.js.map` files via `inlineSources: true` in `tsconfig.json`. Downstream bundlers (Vite, esbuild) were warning on every consumer load because the published tarball ships `dist/` only, while the maps' `sources` field pointed at `../src/*.ts` paths that don't exist post-install. Maps are now self-contained — bundlers stop warning, and DevTools / stack traces still resolve to the original TypeScript source.
