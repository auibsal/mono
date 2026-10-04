import { type BucketKey, buckets } from "./buckets";

export type FileProblem = "empty" | "too_large" | "type_not_allowed";

export class StorageError extends Error {
  readonly code: FileProblem | "not_found" | "request_failed" | "upload_failed";

  constructor(code: StorageError["code"], message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

// Characters Supabase Storage accepts in keys, minus "!" (our escape) and
// "/" (the folder separator).
const SAFE = /^[\w .()+,-]$/;
const ESCAPED = /!([0-9A-F]{2})/g;
const MAX_ENCODED_NAME = 600;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const encodeChar = (char: string) =>
  SAFE.test(char)
    ? char
    : Array.from(
        encoder.encode(char),
        (byte) => `!${byte.toString(16).toUpperCase().padStart(2, "0")}`
      ).join("");

/**
 * Makes a file name safe for a storage key. Supabase only accepts a subset
 * of ASCII, so other characters (Arabic, emoji, "/") become "!XX" UTF-8
 * escapes. Latin names stay readable and every name decodes back exactly.
 */
export const encodeFileName = (name: string) => {
  const trimmed = name.trim() || "file";
  const dot = trimmed.lastIndexOf(".");
  const stem = Array.from(
    dot > 0 ? trimmed.slice(0, dot) : trimmed,
    encodeChar
  );
  const extension =
    dot > 0 ? Array.from(trimmed.slice(dot), encodeChar).join("") : "";
  // Keep keys well under Supabase's 1024-byte limit by shortening the stem.
  let length = stem.join("").length + extension.length;
  while (stem.length > 1 && length > MAX_ENCODED_NAME) {
    length -= stem.pop()?.length ?? 0;
  }
  return stem.join("") + extension;
};

export const decodeFileName = (encoded: string) => {
  const bytes: number[] = [];
  let result = "";
  let index = 0;
  const flush = () => {
    if (bytes.length > 0) {
      result += decoder.decode(new Uint8Array(bytes));
      bytes.length = 0;
    }
  };
  for (const match of encoded.matchAll(ESCAPED)) {
    if (match.index !== index) {
      flush();
      result += encoded.slice(index, match.index);
    }
    bytes.push(Number.parseInt(match[1] ?? "", 16));
    index = match.index + match[0].length;
  }
  flush();
  return result + encoded.slice(index);
};

/** A new, unique object key for `fileName` inside the `prefix` folder. */
export const objectPath = (prefix: string, fileName: string) =>
  `${prefix}/${crypto.randomUUID()}_${encodeFileName(fileName)}`;

/** The original file name of a key made by `objectPath`. */
export const fileNameOf = (path: string) => {
  const segment = path.slice(path.lastIndexOf("/") + 1);
  const separator = segment.indexOf("_");
  return decodeFileName(
    separator === -1 ? segment : segment.slice(separator + 1)
  );
};

/** Checks a file against a bucket's size and type limits. */
export const checkFile = (
  bucket: BucketKey,
  { size, type }: { size: number; type: string }
): FileProblem | null => {
  const { maxBytes, mimeTypes } = buckets[bucket];
  if (size === 0) {
    return "empty";
  }
  if (size > maxBytes) {
    return "too_large";
  }
  if (mimeTypes && !(mimeTypes as readonly string[]).includes(type)) {
    return "type_not_allowed";
  }
  return null;
};
