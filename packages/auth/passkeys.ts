import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Passkeys (WebAuthn) through Supabase Auth. The relying party is
 * auibsal.org (set in the Supabase dashboard), so a passkey works on the
 * Society's own hosts only. A passkey sign-in is a first factor: roles that
 * need two-step sign-in still ask for the authenticator code afterwards.
 */

type Client = SupabaseClient<Database>;

export type PasskeyErrorCode =
  | "already_registered"
  | "cancelled"
  | "expired"
  | "rate_limited"
  | "unknown";

export type PasskeyResult<T = undefined> =
  | { ok: true; value: T }
  | { code: PasskeyErrorCode; ok: false };

export interface Passkey {
  createdAt: string;
  id: string;
  lastUsedAt: string | null;
  name: string | null;
}

/** Longest name Supabase Auth accepts for a passkey. */
export const PASSKEY_NAME_MAX = 120;

/** Whether this browser can create and use passkeys at all. */
export const passkeysSupported = () =>
  typeof window !== "undefined" &&
  typeof window.PublicKeyCredential === "function" &&
  typeof navigator.credentials?.get === "function";

interface PasskeyFailure {
  cause?: unknown;
  code?: unknown;
  status?: unknown;
}

const causeName = (cause: unknown) =>
  typeof cause === "object" && cause !== null && "name" in cause
    ? cause.name
    : undefined;

/**
 * Maps a WebAuthn or Supabase Auth error to a code the UI can translate.
 * Browsers report a dismissed prompt and "no passkey for this site" the
 * same way (NotAllowedError), so both read as "cancelled".
 */
export const toPasskeyError = (
  error: PasskeyFailure | null | undefined
): PasskeyErrorCode => {
  switch (error?.code) {
    case "ERROR_CEREMONY_ABORTED":
      return "cancelled";
    case "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY":
      return causeName(error.cause) === "NotAllowedError"
        ? "cancelled"
        : "unknown";
    case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
      return "already_registered";
    case "webauthn_challenge_expired":
      return "expired";
    case "over_request_rate_limit":
      return "rate_limited";
    default:
      return error?.status === 429 ? "rate_limited" : "unknown";
  }
};

/** Signs in with a passkey saved on this device or a nearby phone. */
export const signInWithPasskey = async (
  supabase: Client
): Promise<PasskeyResult> => {
  const { error } = await supabase.auth.signInWithPasskey();
  return error
    ? { code: toPasskeyError(error), ok: false }
    : { ok: true, value: undefined };
};

/** The signed-in member's passkeys, newest first. */
export const listPasskeys = async (
  supabase: Client
): Promise<PasskeyResult<Passkey[]>> => {
  const { data, error } = await supabase.auth.passkey.list();
  if (error) {
    return { code: toPasskeyError(error), ok: false };
  }
  const passkeys = (data ?? []).map((item) => ({
    createdAt: item.created_at,
    id: item.id,
    lastUsedAt: item.last_used_at ?? null,
    name: item.friendly_name ?? null,
  }));
  passkeys.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { ok: true, value: passkeys };
};

/**
 * Adds a passkey for the signed-in member and names it, so the list can
 * tell devices apart. A failed rename keeps the passkey.
 */
export const addPasskey = async (
  supabase: Client,
  name: string
): Promise<PasskeyResult> => {
  const { data, error } = await supabase.auth.registerPasskey();
  if (error || !data) {
    return { code: toPasskeyError(error), ok: false };
  }
  const friendlyName = name.trim().slice(0, PASSKEY_NAME_MAX);
  if (friendlyName) {
    await supabase.auth.passkey.update({ friendlyName, passkeyId: data.id });
  }
  return { ok: true, value: undefined };
};

export const removePasskey = async (
  supabase: Client,
  passkeyId: string
): Promise<PasskeyResult> => {
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  return error
    ? { code: toPasskeyError(error), ok: false }
    : { ok: true, value: undefined };
};
