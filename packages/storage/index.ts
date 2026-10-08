import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type BucketId, buckets } from "./buckets";
import {
  anonymousObjectPath,
  checkFile,
  objectPath,
  StorageError,
} from "./files";

/**
 * File storage on Supabase Storage. Upload helpers take the caller's
 * Supabase client, so the bucket policies decide what they may write.
 */

type Client = SupabaseClient<Database>;

export interface StoredFile {
  /** Original file name, which may contain any characters. */
  name: string;
  path: string;
  size: number;
  type: string;
}

const upload = async (
  supabase: Client,
  bucket: BucketId,
  path: string,
  file: File
): Promise<StoredFile> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error || !data) {
    throw new StorageError(
      "upload_failed",
      `Upload to ${bucket} failed: ${error?.message ?? "no data"}`
    );
  }

  return { name: file.name, path: data.path, size: file.size, type: file.type };
};

const assertAllowed = (bucket: keyof typeof buckets, file: File) => {
  const problem = checkFile(bucket, file);
  if (problem) {
    throw new StorageError(problem, `${file.name}: ${problem}`);
  }
};

/**
 * Uploads a Journal submission file under a random name. The bucket policy
 * only lets the author write into their own submission while it is in intake.
 */
export const uploadSubmissionFile = (
  supabase: Client,
  submissionId: string,
  file: File
) => {
  assertAllowed("submissions", file);
  return upload(
    supabase,
    buckets.submissions.id,
    anonymousObjectPath(submissionId, file.type),
    file
  );
};

/** Uploads a receipt for a campaign (charity.manage holders). */
export const uploadReceipt = (
  supabase: Client,
  campaignId: string,
  file: File
) => {
  assertAllowed("receipts", file);
  return upload(
    supabase,
    buckets.receipts.id,
    anonymousObjectPath(campaignId, file.type),
    file
  );
};

/**
 * Uploads an internal document to the private library bucket under a
 * random name, library/<audience>/<random>.<ext> (governance.manage
 * holders; read only through apps/api links).
 */
export const uploadLibraryFile = (
  supabase: Client,
  audience: "role" | "council",
  file: File
) => {
  assertAllowed("library", file);
  return upload(
    supabase,
    buckets.library.id,
    anonymousObjectPath(audience, file.type),
    file
  );
};

/** Uploads a public image or PDF into an area of the media bucket. */
export const uploadMedia = async (
  supabase: Client,
  area: string,
  file: File
) => {
  assertAllowed("media", file);
  const stored = await upload(
    supabase,
    buckets.media.id,
    objectPath(area, file.name),
    file
  );
  return { ...stored, url: getMediaUrl(supabase, stored.path) };
};

/** Uploads the signed-in member's picture to media/avatars/<user id>/. */
export const uploadAvatar = async (
  supabase: Client,
  userId: string,
  file: File
) => {
  assertAllowed("media", file);
  const stored = await upload(
    supabase,
    buckets.media.id,
    anonymousObjectPath(`avatars/${userId}`, file.type),
    file
  );
  return { ...stored, url: getMediaUrl(supabase, stored.path) };
};

/** Public URL of a media object. */
export const getMediaUrl = (supabase: Client, path: string) =>
  supabase.storage.from(buckets.media.id).getPublicUrl(path).data.publicUrl;

/**
 * A short-lived link to a private object. Only apps/api calls this, with
 * the admin client, after checking the caller may see the file.
 */
export const createSignedFileUrl = async (
  admin: Client,
  bucket: Exclude<BucketId, "media">,
  path: string,
  {
    download,
    expiresIn = 5 * 60,
  }: { download?: string; expiresIn?: number } = {}
) => {
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, { download });

  if (error || !data) {
    throw new StorageError(
      "not_found",
      `No signed URL for ${path}: ${error?.message ?? "no data"}`
    );
  }
  return data.signedUrl;
};

/** Deletes files the user is allowed to delete. */
export const removeFiles = async (
  supabase: Client,
  bucket: BucketId,
  paths: string[]
) => {
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    throw new StorageError("request_failed", error.message);
  }
};

const LIST_PAGE = 1000;

/** Every file path under a folder, including subfolders. */
const listFolder = async (
  supabase: Client,
  bucket: BucketId,
  folder: string
): Promise<string[]> => {
  const paths: string[] = [];
  const folders = [folder];

  while (folders.length > 0) {
    const current = folders.pop() as string;
    let offset = 0;

    for (;;) {
      // biome-ignore lint/performance/noAwaitInLoops: pages are sequential
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(current, { limit: LIST_PAGE, offset });
      if (error) {
        throw new StorageError("request_failed", error.message);
      }
      for (const object of data ?? []) {
        // Folders have no id.
        (object.id === null ? folders : paths).push(
          `${current}/${object.name}`
        );
      }
      if ((data ?? []).length < LIST_PAGE) {
        break;
      }
      offset += LIST_PAGE;
    }
  }

  return paths;
};

/**
 * Deletes a whole folder, such as `avatars/<user id>` in media. Used with
 * the admin client when an account is deleted; returns how many files were
 * removed.
 */
export const removeFolder = async (
  supabase: Client,
  bucket: BucketId,
  folder: string
) => {
  const paths = await listFolder(supabase, bucket, folder);

  for (let start = 0; start < paths.length; start += LIST_PAGE) {
    // biome-ignore lint/performance/noAwaitInLoops: bounded batches
    await removeFiles(supabase, bucket, paths.slice(start, start + LIST_PAGE));
  }

  return paths.length;
};

export { type BucketId, type BucketKey, buckets } from "./buckets";
export {
  anonymousObjectPath,
  checkFile,
  decodeFileName,
  encodeFileName,
  type FileProblem,
  fileNameOf,
  StorageError,
} from "./files";
