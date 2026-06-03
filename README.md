# strapi-revalidate
A framework-agnostic Node.js/TypeScript library that solves runtime cache invalidation for Strapi v5 content in SSR environments. When Strapi publishes content, it fires a webhook → this library receives it, clears the affected cache keys by tag, and the next request serves fresh data.
