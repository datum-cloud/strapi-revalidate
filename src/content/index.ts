/**
 * Public content surface.
 *
 * Re-exports every built-in fetcher and their GraphQL queries. Queries are
 * exported as `const` strings so consumers can extend them with additional
 * fields by composing their own query and passing it to the client directly.
 */

export type { ContentDeps } from './articles.js';
export {
  fetchArticles,
  fetchArticle,
  ARTICLES_QUERY,
  ARTICLE_BY_SLUG_QUERY,
} from './articles.js';
export { fetchAuthors, fetchAuthor, AUTHORS_QUERY, AUTHOR_BY_SLUG_QUERY } from './authors.js';
