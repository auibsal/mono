import type { Database } from "@repo/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type BucketId, buckets } from "./buckets";
import { checkFile, fileNameOf, objectPath, StorageError } from "./files";

/**
 * File storage on Supabase Storage. Every helper takes the caller's Supabase
 * client (browser, server or native), so the bucket policies decide what the
 * signed-in user may read and write.
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

/** Uploads a private file for an organization the user belongs to. */
export const uploadOrganizationFile = (
  supabase: Client,
  organizationId: string,
  file: File
) => {
  assertAllowed("orgFiles", file);
  return upload(
    supabase,
    buckets.orgFiles.id,
    objectPath(organizationId, file.name),
    file
  );
};

/** Uploads the signed-in user's profile picture; returns its public URL. */
export const uploadAvatar = async (
  supabase: Client,
  userId: string,
  file: File
) => {
  assertAllowed("avatars", file);
  const stored = await upload(
    supabase,
    buckets.avatars.id,
    objectPath(userId, file.name),
    file
  );
  return { ...stored, url: getAvatarUrl(supabase, stored.path) };
};

/** Public URL of an avatar. Avatars are readable by anyone with the URL. */
export const getAvatarUrl = (supabase: Client, path: string) =>
  supabase.storage.from(buckets.avatars.id).getPublicUrl(path).data.publicUrl;

/**
 * A time-limited link to a private organization file. With `download`,
 * browsers save it under its original name (or the name you pass).
 */
export const getOrganizationFileUrl = async (
  supabase: Client,
  path: string,
  {
    download,
    expiresIn = 60 * 60,
  }: { download?: string | boolean; expiresIn?: number } = {}
) => {
  const { data, error } = await supabase.storage
    .from(buckets.orgFiles.id)
    .createSignedUrl(path, expiresIn, {
      download: download === true ? fileNameOf(path) : download,
    });

  if (error || !data) {
    throw new StorageError(
      "not_found",
      `No signed URL for ${path}: ${error?.message ?? "no data"}`
    );
  }
  return data.signedUrl;
};

/** Files in an organization's folder, newest first. */
export const listOrganizationFiles = async (
  supabase: Client,
  organizationId: string,
  { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<(StoredFile & { createdAt: string | null })[]> => {
  const { data, error } = await supabase.storage
    .from(buckets.orgFiles.id)
    .list(organizationId, {
      limit,
      offset,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    throw new StorageError("request_failed", error.message);
  }

  // Folders have no id; files carry their size and type in metadata.
  return (data ?? []).flatMap((object) => {
    if (object.id === null) {
      return [];
    }
    const path = `${organizationId}/${object.name}`;
    return [
      {
        createdAt: object.created_at,
        name: fileNameOf(path),
        path,
        size: object.metadata?.size ?? 0,
        type: object.metadata?.mimetype ?? "",
      },
    ];
  });
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
 * Deletes a whole folder, such as `<organization id>` in org-files or
 * `<user id>` in avatars. Used with the admin client when an organization or
 * an account is deleted; returns how many files were removed.
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
  checkFile,
  decodeFileName,
  encodeFileName,
  type FileProblem,
  fileNameOf,
  StorageError,
} from "./files";
