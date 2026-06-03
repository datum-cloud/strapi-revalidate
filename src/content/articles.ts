/**
 * Article fetchers.
 *
 * Refactored from datum.net's `articles.ts`: same GraphQL queries and same
 * primary-then-fallback read pattern, but the client and cache are injected
 * rather than module-level singletons. Datum-specific transforms (block
 * stripping, top-3 cover preservation, reading-time calculation) are
 * intentionally not ported — those belong in application code.
 */

import type { CacheManager } from '../cache/manager.js';
import type { StrapiClient } from '../client/index.js';
import type { StrapiArticle, StrapiArticlesResponse } from '../types/strapi.js';

const LIST_CACHE_KEY = 'strapi-articles';
const DETAIL_CACHE_PREFIX = 'strapi-article-';
const FALLBACK_LIST_KEY = 'articles';
const FALLBACK_DETAIL_PREFIX = 'article-';

/** GraphQL query: every published article, newest first. */
export const ARTICLES_QUERY = `
  query GetArticles {
    articles(pagination: { limit: 100 }, sort: ["originalPublishedAt:desc"]) {
      documentId
      title
      slug
      description
      originalPublishedAt
      blocks {
        __typename
        ... on ComponentSharedRichText {
          id
          body
        }
      }
      cover {
        url
        alternativeText
        width
        height
        formats
      }
      author {
        documentId
        slug
        name
        isTeam
        avatar {
          url
          alternativeText
        }
      }
      category {
        name
        slug
      }
    }
  }
`;

/** GraphQL query: a single article by slug, including SEO and quote blocks. */
export const ARTICLE_BY_SLUG_QUERY = `
  query GetArticleBySlug($slug: String!) {
    articles(filters: { slug: { eq: $slug } }) {
      documentId
      title
      slug
      description
      originalPublishedAt
      blocks {
        __typename
        ... on ComponentSharedQuote {
          body
          title
        }
        ... on ComponentSharedRichText {
          id
          body
        }
      }
      cover {
        url
        alternativeText
        width
        height
        formats
      }
      author {
        documentId
        slug
        name
        isTeam
        avatar {
          url
          alternativeText
        }
      }
      category {
        name
        slug
      }
      seo {
        metaTitle
        metaDescription
        ogTitle
        ogDescription
        shareImage {
          url
        }
      }
    }
  }
`;

/** Dependencies threaded into every content fetcher. */
export interface ContentDeps {
  client: StrapiClient;
  cache: CacheManager;
}

/**
 * Fetch every article from Strapi. Reads from cache first; on Strapi failure,
 * serves stale data from the persistent fallback cache instead of throwing.
 *
 * Cache key: `strapi-articles`. Tags: `["articles"]`.
 */
export async function fetchArticles({ client, cache }: ContentDeps): Promise<StrapiArticle[]> {
  const cached = await cache.get<StrapiArticle[]>(LIST_CACHE_KEY);
  if (cached) return cached;

  const response = await client.query<StrapiArticlesResponse>(ARTICLES_QUERY);

  if (!response?.articles) {
    const fallback = await cache.getFallback<StrapiArticle[]>(FALLBACK_LIST_KEY);
    if (fallback) {
      console.warn(`Strapi unreachable — serving ${fallback.length} articles from fallback`);
      return fallback;
    }
    return [];
  }

  await cache.set(LIST_CACHE_KEY, response.articles, { tags: ['articles'] });
  // Mirror to fallback under the legacy datum.net key so manual recovery is straightforward.
  await cache.set(FALLBACK_LIST_KEY, response.articles, { tags: ['articles'] });
  return response.articles;
}

/**
 * Fetch a single article by slug. Cached per slug; falls back to stale
 * data when Strapi is unreachable.
 *
 * Cache key: `strapi-article-<slug>`. Tags: `["articles", "article:<slug>"]`.
 */
export async function fetchArticle(
  slug: string,
  { client, cache }: ContentDeps
): Promise<StrapiArticle | null> {
  const cacheKey = `${DETAIL_CACHE_PREFIX}${slug}`;
  const cached = await cache.get<StrapiArticle>(cacheKey);
  if (cached) return cached;

  const response = await client.query<StrapiArticlesResponse>(ARTICLE_BY_SLUG_QUERY, { slug });

  if (!response?.articles || response.articles.length === 0) {
    const fallback = await cache.getFallback<StrapiArticle>(`${FALLBACK_DETAIL_PREFIX}${slug}`);
    if (fallback) {
      console.warn(`Strapi unreachable — serving article "${slug}" from fallback`);
      return fallback;
    }
    return null;
  }

  const article = response.articles[0];
  const tags = ['articles', `article:${slug}`];
  await cache.set(cacheKey, article, { tags });
  await cache.set(`${FALLBACK_DETAIL_PREFIX}${slug}`, article, { tags });
  return article;
}
