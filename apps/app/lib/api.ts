import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

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
 * Calls apps/api (exports, signed URLs, account deletion…) with the member's
 * access token. The API verifies it and re-checks permissions itself.
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

/** Like callApi, for endpoints that answer with text (CSV exports). */
export const callApiText = async (
  supabase: SupabaseClient<Database>,
  path: string,
  body: object,
  fetchImpl: typeof fetch = fetch
): Promise<string> => {
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
    },
    method: "POST",
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new ApiError(response.status, json.error ?? "request_failed");
  }

  return response.text();
};
