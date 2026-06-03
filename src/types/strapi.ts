/**
 * Type definitions for Strapi v5 content types.
 *
 * These mirror the shape returned by the default Strapi v5 GraphQL API.
 * They are intentionally narrow: only fields that strapi-revalidate's
 * built-in helpers query are included. Consumers fetching custom content
 * types should declare their own interfaces and pass them through
 * `createStrapiClient().query<T>()`.
 */

/** A single Strapi media format (thumbnail, small, medium, large). */
export interface StrapiImageFormat {
  url: string;
  width?: number;
  height?: number;
}

/** A Strapi media asset with optional responsive formats. */
export interface StrapiImage {
  url: string;
  alternativeText?: string;
  caption?: string;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: StrapiImageFormat;
    small?: StrapiImageFormat;
    medium?: StrapiImageFormat;
    large?: StrapiImageFormat;
  };
}

/** Minimal author reference embedded in other content types. */
export interface StrapiAuthor {
  documentId?: string;
  slug?: string;
  name: string;
  isTeam?: boolean;
  avatar?: StrapiImage;
}

/** Social handles for a Strapi author. */
export interface StrapiSocial {
  twitter?: string;
  linkedin?: string;
  github?: string;
  discord?: string;
  email?: string;
}

/** Full author record (Strapi `author` content type). */
export interface StrapiAuthorFull {
  documentId: string;
  slug?: string;
  name: string;
  title?: string;
  bio?: string;
  isTeam?: boolean;
  team?: string;
  avatar?: StrapiImage;
  social?: StrapiSocial;
  location?: string;
  timezone?: string;
}

/** GraphQL response shape for the `authors` query. */
export interface StrapiAuthorsResponse {
  authors: StrapiAuthorFull[];
}

/** Category reference on an article. */
export interface StrapiCategory {
  name: string;
  slug: string;
}

/** SEO component fields. */
export interface StrapiSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  shareImage?: { url?: string };
}

/** A block of an article body (Strapi Dynamic Zone entry). */
export interface StrapiBlock {
  __typename?: string;
  id?: string;
  body?: string;
  title?: string;
}

/** Article record (Strapi `article` content type). */
export interface StrapiArticle {
  documentId: string;
  title: string;
  slug: string;
  description?: string;
  originalPublishedAt?: string;
  blocks?: StrapiBlock[];
  cover?: StrapiImage;
  author?: StrapiAuthor;
  category?: StrapiCategory;
  seo?: StrapiSeo;
}

/** GraphQL response shape for the `articles` query. */
export interface StrapiArticlesResponse {
  articles: StrapiArticle[];
}
