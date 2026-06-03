# strapi-revalidate

Keep your SSR frontend in sync with Strapi content — automatically.

[![npm version](https://img.shields.io/npm/v/strapi-revalidate.svg)](https://www.npmjs.com/package/strapi-revalidate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

`strapi-revalidate` is a framework-agnostic Node.js library for SSR frontends using Strapi v5 as a headless CMS. It caches Strapi content locally (file, memory, or Redis), receives Strapi publish webhooks, and invalidates only the affected cache entries — so the next request always serves fresh data without a full rebuild or manual intervention. Battle-tested in production at [datum.net](https://datum.net).

## How this differs from Strapi-side cache plugins

**strapi-revalidate** solves a different problem than `strapi-cache`, `strapi-plugin-rest-cache`, and the dozens of similar Strapi plugins on npm and GitHub.

Those are **Strapi plugins** — they install into `config/plugins.js`, run inside the Strapi server process, and cache Strapi's own API responses before they leave the server. They have no awareness of your frontend at all.

**strapi-revalidate** lives in your **frontend SSR process** — Astro, Next.js, SvelteKit, Nuxt, Express, whatever. It caches the data your frontend fetches *from* Strapi, and invalidates that cache the moment Strapi publishes new content via webhook.

The two approaches are complementary. If you're already running `strapi-cache` on your Strapi instance, keep it — `strapi-revalidate` works alongside it without conflict.

## Install

```bash
npm install strapi-revalidate
```

## Quickstart

Each snippet below is a complete, copy-pasteable example. Pick your framework.

### Astro

```ts
// src/lib/strapi.ts
import { createStrapiRevalidate } from 'strapi-revalidate';

export const { client, cache, webhook } = createStrapiRevalidate({
  url: import.meta.env.STRAPI_URL,
  token: import.meta.env.STRAPI_TOKEN,
  webhook: { secret: import.meta.env.STRAPI_WEBHOOK_SECRET },
});
```

```astro
---
// src/pages/blog/index.astro
import { fetchArticles } from 'strapi-revalidate/content';
import { client, cache } from '../../lib/strapi';

const articles = await fetchArticles({ client, cache });
---
<ul>
  {articles.map((a) => <li><a href={`/blog/${a.slug}`}>{a.title}</a></li>)}
</ul>
```

```ts
// src/pages/api/strapi-webhook.ts
import type { APIRoute } from 'astro';
import { webhook } from '../../lib/strapi';

export const POST: APIRoute = async ({ request }) => {
  let status = 200;
  let body: unknown = {};
  await webhook(request, {
    status: (code) => {
      status = code;
    },
    json: (value) => {
      body = value;
    },
  });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Next.js (App Router)

```ts
// lib/strapi.ts
import { createStrapiRevalidate } from 'strapi-revalidate';

export const { client, cache, webhook } = createStrapiRevalidate({
  url: process.env.STRAPI_URL!,
  token: process.env.STRAPI_TOKEN!,
  webhook: { secret: process.env.STRAPI_WEBHOOK_SECRET },
});
```

```tsx
// app/blog/page.tsx
import { fetchArticles } from 'strapi-revalidate/content';
import { client, cache } from '@/lib/strapi';

export default async function BlogPage() {
  const articles = await fetchArticles({ client, cache });
  return (
    <ul>
      {articles.map((a) => (
        <li key={a.documentId}>
          <a href={`/blog/${a.slug}`}>{a.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

```ts
// app/api/strapi-webhook/route.ts
import { NextResponse } from 'next/server';
import { webhook } from '@/lib/strapi';

export async function POST(request: Request) {
  let status = 200;
  let body: unknown = {};
  await webhook(request, {
    status: (code) => {
      status = code;
    },
    json: (value) => {
      body = value;
    },
  });
  return NextResponse.json(body, { status });
}
```

### SvelteKit

```ts
// src/lib/strapi.ts
import { createStrapiRevalidate } from 'strapi-revalidate';
import { env } from '$env/dynamic/private';

export const { client, cache, webhook } = createStrapiRevalidate({
  url: env.STRAPI_URL,
  token: env.STRAPI_TOKEN,
  webhook: { secret: env.STRAPI_WEBHOOK_SECRET },
});
```

```ts
// src/routes/blog/+page.server.ts
import { fetchArticles } from 'strapi-revalidate/content';
import { client, cache } from '$lib/strapi';

export const load = async () => {
  const articles = await fetchArticles({ client, cache });
  return { articles };
};
```

```ts
// src/routes/api/strapi-webhook/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { webhook } from '$lib/strapi';

export const POST: RequestHandler = async ({ request }) => {
  let status = 200;
  let body: unknown = {};
  await webhook(request, {
    status: (code) => {
      status = code;
    },
    json: (value) => {
      body = value;
    },
  });
  return json(body, { status });
};
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `STRAPI_URL` | Yes | — | Your Strapi Cloud base URL |
| `STRAPI_TOKEN` | Yes | — | Strapi API token (Settings → API Tokens) |
| `STRAPI_WEBHOOK_SECRET` | Recommended | — | Secret set in Strapi webhook config |
| `STRAPI_CACHE_TTL` | No | `3600` | Cache TTL in seconds |
| `STRAPI_TIMEOUT` | No | `3` | Request timeout in seconds |

## Strapi webhook setup

1. In your Strapi Cloud admin, open **Settings → Webhooks → Add new webhook**.
2. **Name**: `strapi-revalidate` (or whatever you like).
3. **URL**: the public URL of the API route you mounted in the quickstart, e.g. `https://example.com/api/strapi-webhook`.
4. **Headers**: add `Authorization: Bearer <STRAPI_WEBHOOK_SECRET>` so the handler can verify the source. The handler also accepts `X-Strapi-Signature` or `strapi-webhook-secret` headers if you'd rather not use `Authorization`.
5. **Events**: enable at minimum `entry.publish`, `entry.unpublish`, and `entry.update`. Add `entry.delete` if you want deletions to clear cache too.
6. Save the webhook. Publish any entry — within seconds, the matching cache tags are cleared and the next request serves fresh data.

<!-- screenshot: strapi-webhook-config -->

## Cache drivers

| Driver | Default | Use case |
|---|---|---|
| `file` | ✓ | Single-instance servers. Survives process restarts. |
| `memory` | | Dev and testing. Fast, lost on restart. |
| `redis` | | Multi-instance / edge deploys. Requires `ioredis`. Coming v1.x. |

Select a driver via `cache.driver` in config:

```ts
createStrapiRevalidate({
  url: process.env.STRAPI_URL!,
  token: process.env.STRAPI_TOKEN!,
  cache: { driver: 'memory' },
});
```

## How the fallback cache works

Every successful Strapi fetch writes to **two** caches: the primary TTL cache (configurable expiry, cleared by webhook) and a persistent fallback cache (no expiry, file-backed). If Strapi is unreachable on a future fetch, the fallback serves stale data instead of throwing or returning empty — keeping your site online during Strapi outages or deploys. The fallback is on by default and cannot be disabled.

## Contributing

Issues and PRs welcome at [github.com/datum-cloud/strapi-revalidate](https://github.com/datum-cloud/strapi-revalidate/issues). This library was extracted from production code at [datum.net](https://datum.net); contributions that keep the public surface small and the dependencies few are especially appreciated.

## License

MIT
