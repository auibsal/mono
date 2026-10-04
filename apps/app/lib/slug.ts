const NOT_ALLOWED = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const VALID_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_LENGTH = 64;

/** Matches the database check on organizations.slug. */
export const isValidSlug = (slug: string) =>
  slug.length >= 2 && slug.length <= MAX_LENGTH && VALID_SLUG.test(slug);

const randomSuffix = () =>
  Math.random().toString(36).slice(2, 8).padEnd(6, "0");

/**
 * A URL-safe address for an organization name. Arabic and Kurdish names have
 * no Latin letters to keep, so they get a random one the user can edit.
 */
export const suggestSlug = (
  name: string,
  suffix: () => string = randomSuffix
) => {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(NOT_ALLOWED, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, MAX_LENGTH)
    .replace(EDGE_DASHES, "");

  return isValidSlug(slug) ? slug : `org-${suffix()}`;
};
