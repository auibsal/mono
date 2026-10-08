import "server-only";

import { keys } from "@repo/auth/keys";
import { authenticateRequest } from "@repo/auth/verify";
import type { Database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { DataError } from "@repo/sal-data/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * The public API, version 1: what third-party apps (Sign in with SAL) and
 * the Society's own tools call. Each request runs as the member who holds
 * the token, so Row Level Security decides as it does in the Nexus, and the
 * database limits an app to the areas the Society granted it. Nothing here
 * uses the admin client.
 *
 * Bearer tokens only, never cookies, so any origin may call it.
 */

const CORS = {
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
};

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    headers: { ...CORS, "Cache-Control": "no-store" },
    status,
  });

export const problem = (status: number, error: string, detail?: unknown) =>
  json({ error, ...(detail === undefined ? {} : { detail }) }, status);

export const preflight = () =>
  new Response(null, { headers: CORS, status: 204 });

type Client = SupabaseClient<Database>;

export interface Caller {
  /** The third-party app, or null for the Society's own apps. */
  clientId: string | null;
  supabase: Client;
  userId: string;
}

/** A guest client for the public parts (published calls and issues). */
const guest = (): Client => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    keys();
  return createClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
};

// Postgres and PostgREST codes → HTTP.
const STATUS: Record<string, number> = {
  "22023": 400,
  "23502": 400,
  "23505": 409,
  "23514": 400,
  "42501": 403,
  P0001: 400,
  PGRST116: 404,
};

const fail = (error: unknown) => {
  if (error instanceof DataError) {
    const status = STATUS[error.code] ?? 500;
    if (status < 500) {
      return problem(status, error.code, error.message);
    }
  }
  log.error(`v1 request failed: ${parseError(error)}`);
  return problem(500, "server_error");
};

type Params = Record<string, string>;

/** A route that needs a member (or an app acting for one). */
export const member =
  <P extends Params = Params>(
    handler: (caller: Caller, request: Request, params: P) => Promise<Response>
  ) =>
  async (request: Request, context: { params: Promise<P> }) => {
    const session = await authenticateRequest(request, { apps: true });
    if (!session) {
      return problem(401, "unauthorized");
    }
    try {
      return await handler(
        {
          clientId: session.clientId,
          supabase: session.supabase,
          userId: session.userId,
        },
        request,
        await context.params
      );
    } catch (error) {
      return fail(error);
    }
  };

/** A route anyone may call; a member's token, when sent, is used. */
export const open =
  (handler: (supabase: Client, request: Request) => Promise<Response>) =>
  async (request: Request) => {
    try {
      const session = request.headers.get("authorization")
        ? await authenticateRequest(request, { apps: true })
        : null;
      return await handler(session?.supabase ?? guest(), request);
    } catch (error) {
      return fail(error);
    }
  };

/** Parses a JSON body, or answers 400 with the problems. */
export const body = async <S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<{ data: z.infer<S> } | { response: Response }> => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return {
      response: problem(
        400,
        "invalid_body",
        parsed.error.issues.map((i) => ({
          message: i.message,
          path: i.path.join("."),
        }))
      ),
    };
  }
  return { data: parsed.data };
};
