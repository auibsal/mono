import { createHash } from "node:crypto";

const NON_DIGITS = /\D/g;
const INTERNATIONAL_PREFIX = /^00/;

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Country code and number as digits only (9647701234567), the form Meta
 * expects and Supabase stores. TikTok wants E.164, i.e. with a leading "+".
 */
export const phoneDigits = (phone: string) =>
  phone.replace(NON_DIGITS, "").replace(INTERNATIONAL_PREFIX, "");

export const compact = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== undefined && entry !== null && entry !== ""
    )
  ) as Partial<T>;

export const unixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);
