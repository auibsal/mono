import { project } from "@repo/config";
import { json, preflight } from "@/lib/v1";

export const OPTIONS = preflight;

/** GET /v1: what this API offers. The reference is in SAL Docs. */
export const GET = () =>
  json({
    docs: `${project.repoUrl}/blob/main/docs/platform/api.md`,
    endpoints: [
      "GET /v1/me",
      "GET /v1/journal/calls",
      "GET /v1/journal/issues",
      "GET /v1/journal/submissions",
      "POST /v1/journal/submissions",
      "POST /v1/journal/submissions/{id}/transition",
      "GET /v1/journal/reviews",
      "POST /v1/journal/reviews/{assignment}/score",
      "GET /v1/journal/entries?issue={id}",
      "POST /v1/journal/entries/{id}/decision",
    ],
    name: `${project.name} API`,
    signIn: {
      authorize: "/auth/v1/oauth/authorize",
      discovery: "/auth/v1/.well-known/openid-configuration",
      token: "/auth/v1/oauth/token",
    },
    version: "1",
  });
