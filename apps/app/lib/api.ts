import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { detectPlatform } from "./platform";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string) {
    super(`API request failed (${status}): ${code}`);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Calls apps/api (checkout, webhooks portal, collaboration tokens) with the
 * user's access token. The API verifies it and applies its own checks; the
 * platform header lets it enforce the store billing rules.
 */
export const callApi = async <T>(
  supabase: SupabaseClient<Database>,
  path: string,
  body: object,
  fetchImpl: typeof fetch = fetch
): Promise<T> => {
  if (!env.NEXT_PUBLIC_API_URL) {
    throw new ApiError(0, "api_not_configured");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new ApiError(401, "unauthorized");
  }

  const response = await fetchImpl(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "x-client-platform": detectPlatform(),
    },
    method: "POST",
  });
  const json = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new ApiError(response.status, json.error ?? "request_failed");
  }

  return json as T;
};
