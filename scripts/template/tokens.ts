/** Placeholder syntax: an UPPER_SNAKE_CASE name wrapped in double braces. */
export const TOKEN_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

export const knownTokens = [
  "ORG_NAME",
  "ORG_SLUG",
  "PROJECT_NAME",
  "PROJECT_SLUG",
  "PROJECT_URL",
  "SUPPORT_EMAIL",
  "REPO_URL",
  "BUNDLE_ID",
  "YEAR",
] as const;

export type Token = (typeof knownTokens)[number];

export interface Answers {
  bundleId: string;
  orgName: string;
  orgSlug: string;
  projectName: string;
  projectSlug: string;
  projectUrl: string;
  repoUrl: string;
  supportEmail: string;
  year: number;
}

export const tokenValues = (answers: Answers): Record<Token, string> => ({
  BUNDLE_ID: answers.bundleId,
  ORG_NAME: answers.orgName,
  ORG_SLUG: answers.orgSlug,
  PROJECT_NAME: answers.projectName,
  PROJECT_SLUG: answers.projectSlug,
  PROJECT_URL: answers.projectUrl,
  REPO_URL: answers.repoUrl,
  SUPPORT_EMAIL: answers.supportEmail,
  YEAR: String(answers.year),
});

/** Replaces every known token; unknown tokens are left untouched. */
export const replaceTokens = (content: string, values: Record<Token, string>) =>
  content.replace(TOKEN_PATTERN, (match, name: string) =>
    name in values ? values[name as Token] : match
  );

export const findTokens = (content: string) =>
  [...content.matchAll(TOKEN_PATTERN)].map((match) => match[1] as string);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Android application IDs: dot-separated segments that start with a letter.
const BUNDLE_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STARTS_WITH_LETTER = /^[a-z]/;

export const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toBundleSegment = (value: string) => {
  const segment = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return STARTS_WITH_LETTER.test(segment) ? segment : `app${segment}`;
};

/** `https://reserve.example.iq` + `reserve-app` → `iq.example.reserve.reserveapp`. */
export const deriveBundleId = (projectUrl: string, projectSlug: string) => {
  const labels = new URL(projectUrl).hostname
    .split(".")
    .filter((label) => label !== "www")
    .reverse()
    .map(toBundleSegment);
  const appSegment = toBundleSegment(projectSlug.replace(/-/g, ""));

  return labels.at(-1) === appSegment
    ? labels.join(".")
    : [...labels, appSegment].join(".");
};

export const validate = {
  bundleId: (value: string) =>
    BUNDLE_ID.test(value)
      ? undefined
      : "Use reverse-DNS form with letters, digits or _ (e.g. iq.example.app).",
  email: (value: string) =>
    EMAIL.test(value) ? undefined : "Enter a valid email address.",
  required: (value: string) =>
    value.trim().length > 0 ? undefined : "This value is required.",
  slug: (value: string) =>
    SLUG.test(value)
      ? undefined
      : "Use lowercase letters, digits and single hyphens.",
  url: (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:"
        ? undefined
        : "Use an http(s) URL.";
    } catch {
      return "Enter a full URL, e.g. https://example.iq.";
    }
  },
};
