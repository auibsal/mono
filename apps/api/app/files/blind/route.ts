import { authenticateRequest } from "@repo/auth/verify";
import { createAdminClient } from "@repo/database/admin";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { createSignedFileUrl } from "@repo/storage";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  blindExtensions,
  isBlindMimeType,
  stripMetadata,
} from "@/lib/blind-copy";
import { corsHeaders, preflight } from "@/lib/cors";

export const OPTIONS = preflight;
export const maxDuration = 60;

const body = z.object({ entry: z.uuid() });

const BUCKET = "submissions";

type Admin = ReturnType<typeof createAdminClient>;
interface FileRow {
  blind_path: string | null;
  id: string;
  kind: string;
  mime_type: string;
  storage_path: string;
}

/** Makes (once) and stores the metadata-free copy of one file. */
const ensureBlindCopy = async (
  admin: Admin,
  entryId: string,
  file: FileRow
) => {
  if (file.blind_path) {
    return file.blind_path;
  }
  if (!isBlindMimeType(file.mime_type)) {
    throw new Error(`No blind copy for ${file.mime_type}`);
  }
  const { data, error } = await admin.storage
    .from(BUCKET)
    .download(file.storage_path);
  if (error || !data) {
    throw new Error(`Download failed: ${error?.message ?? "no data"}`);
  }
  const stripped = await stripMetadata(
    new Uint8Array(await data.arrayBuffer()),
    file.mime_type
  );
  const path = `blind/${entryId}/${crypto.randomUUID()}.${blindExtensions[file.mime_type]}`;
  const upload = await admin.storage
    .from(BUCKET)
    .upload(path, stripped, { contentType: file.mime_type, upsert: false });
  if (upload.error) {
    throw new Error(`Upload failed: ${upload.error.message}`);
  }
  const saved = await admin
    .schema("journal")
    .from("submission_files")
    .update({ blind_path: path })
    .eq("id", file.id)
    .is("blind_path", null)
    .select("blind_path")
    .maybeSingle();
  if (saved.data?.blind_path) {
    return saved.data.blind_path;
  }
  // Another request made the copy first: keep theirs, drop ours.
  await admin.storage.from(BUCKET).remove([path]);
  const current = await admin
    .schema("journal")
    .from("submission_files")
    .select("blind_path")
    .eq("id", file.id)
    .single();
  if (!current.data?.blind_path) {
    throw new Error("Blind copy not recorded");
  }
  return current.data.blind_path;
};

/**
 * Five-minute links to the blind copies of a submission's files, for anyone
 * who may read the blind entry (assigned readers, the issue's editors, the
 * Submissions Manager, the Advisory Board for flagged work): the caller's
 * own read of journal.blind_entries decides, under RLS. Copies have author
 * metadata stripped; originals are never returned here, and a file that
 * cannot be stripped is reported as unavailable rather than sent as is.
 */
export const POST = async (request: Request) => {
  const headers = corsHeaders(request);
  const json = (data: object, status = 200) =>
    NextResponse.json(data, { headers, status });

  const session = await authenticateRequest(request);
  if (!session) {
    return json({ error: "unauthorized" }, 401);
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "invalid_request" }, 400);
  }
  const entryId = parsed.data.entry;

  const { data: entry } = await session.supabase
    .schema("journal")
    .from("blind_entries")
    .select("id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) {
    return json({ error: "not_found" }, 404);
  }

  const admin = createAdminClient();
  const { data: key } = await admin
    .schema("journal")
    .from("blind_keys")
    .select("submission_id")
    .eq("blind_entry_id", entryId)
    .single();
  if (!key) {
    return json({ files: [] });
  }
  const { data: rows } = await admin
    .schema("journal")
    .from("submission_files")
    .select("id, kind, mime_type, storage_path, blind_path")
    .eq("submission_id", key.submission_id)
    .order("created_at");

  const files = await Promise.all(
    (rows ?? []).map(async (file, index) => {
      const label = `${file.kind}-${index + 1}.${
        isBlindMimeType(file.mime_type)
          ? blindExtensions[file.mime_type]
          : "bin"
      }`;
      try {
        const path = await ensureBlindCopy(admin, entryId, file);
        const url = await createSignedFileUrl(admin, BUCKET, path, {
          download: label,
        });
        return { kind: file.kind, mimeType: file.mime_type, name: label, url };
      } catch (error) {
        log.error(`Blind copy failed for ${file.id}: ${parseError(error)}`);
        return {
          kind: file.kind,
          mimeType: file.mime_type,
          name: label,
          url: null,
        };
      }
    })
  );
  return json({ files });
};
