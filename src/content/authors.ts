/**
 * Author fetchers.
 *
 * Refactored from datum.net's `authors.ts`. Datum-specific concerns (team
 * sorting, cardCategories normalization, color helpers) are intentionally
 * out of scope — this module returns Strapi authors as-is.
 */

import type { StrapiAuthorFull, StrapiAuthorsResponse } from '../types/strapi.js';
import type { ContentDeps } from './articles.js';

const LIST_CACHE_KEY = 'strapi-authors';
const DETAIL_CACHE_PREFIX = 'strapi-author-';
const FALLBACK_LIST_KEY = 'authors';
const FALLBACK_DETAIL_PREFIX = 'author-';

/** GraphQL query: every author. */
export const AUTHORS_QUERY = `
  query GetAuthors {
    authors(pagination: { limit: 100 }) {
      documentId
      slug
      name
      title
      bio
      isTeam
      team
      location
      timezone
      avatar {
        url
        alternativeText
      }
      social {
        twitter
        linkedin
        github
        discord
        email
      }
    }
  }
`;

/** GraphQL query: a single author by slug. */
export const AUTHOR_BY_SLUG_QUERY = `
  query GetAuthorBySlug($slug: String!) {
    authors(filters: { slug: { eq: $slug } }) {
      documentId
      slug
      name
      title
      bio
      isTeam
      team
      location
      timezone
      avatar {
        url
        alternativeText
      }
      social {
        twitter
        linkedin
        github
        discord
        email
      }
    }
  }
`;

/**
 * Fetch every author from Strapi. Caches the list; falls back to stale data
 * on Strapi failure.
 *
 * Cache key: `strapi-authors`. Tags: `["authors"]`.
 */
export async function fetchAuthors({ client, cache }: ContentDeps): Promise<StrapiAuthorFull[]> {
  const cached = await cache.get<StrapiAuthorFull[]>(LIST_CACHE_KEY);
  if (cached) return cached;

  const response = await client.query<StrapiAuthorsResponse>(AUTHORS_QUERY);

  if (!response?.authors) {
    const fallback = await cache.getFallback<StrapiAuthorFull[]>(FALLBACK_LIST_KEY);
    if (fallback) {
      console.warn(`Strapi unreachable — serving ${fallback.length} authors from fallback`);
      return fallback;
    }
    return [];
  }

  await cache.set(LIST_CACHE_KEY, response.authors, { tags: ['authors'] });
  await cache.set(FALLBACK_LIST_KEY, response.authors, { tags: ['authors'] });
  return response.authors;
}

/**
 * Fetch a single author by slug. Cached per slug; falls back to stale data
 * on Strapi failure.
 *
 * Cache key: `strapi-author-<slug>`. Tags: `["authors", "author:<slug>"]`.
 */
export async function fetchAuthor(
  slug: string,
  { client, cache }: ContentDeps
): Promise<StrapiAuthorFull | null> {
  const cacheKey = `${DETAIL_CACHE_PREFIX}${slug}`;
  const cached = await cache.get<StrapiAuthorFull>(cacheKey);
  if (cached) return cached;

  const response = await client.query<StrapiAuthorsResponse>(AUTHOR_BY_SLUG_QUERY, { slug });

  if (!response?.authors || response.authors.length === 0) {
    const fallback = await cache.getFallback<StrapiAuthorFull>(`${FALLBACK_DETAIL_PREFIX}${slug}`);
    if (fallback) {
      console.warn(`Strapi unreachable — serving author "${slug}" from fallback`);
      return fallback;
    }
    return null;
  }

  const author = response.authors[0];
  const tags = ['authors', `author:${slug}`];
  await cache.set(cacheKey, author, { tags });
  await cache.set(`${FALLBACK_DETAIL_PREFIX}${slug}`, author, { tags });
  return author;
}
