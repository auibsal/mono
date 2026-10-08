/**
 * Buckets created by the storage migration (…_storage_revalidation.sql).
 * Limits mirror the bucket settings so uploads fail fast with a clear error;
 * the bucket enforces them either way.
 *
 * Private buckets are never read by clients: apps/api checks access and
 * issues short-lived signed URLs.
 */
export const buckets = {
  /** Private: the internal document library. */
  library: {
    id: "library",
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: undefined,
    public: false,
  },
  /** Public: published images, issue PDFs, document PDFs, avatars/<user id>/…. */
  media: {
    id: "media",
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ],
    public: true,
  },
  /** Private: charity receipts, <campaign id>/<random>.<ext>. */
  receipts: {
    id: "receipts",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    public: false,
  },
  /** Private: Journal submissions, <submission id>/<random>.<ext>; blind copies under blind/. */
  submissions: {
    id: "submissions",
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ],
    public: false,
  },
} as const;

export type BucketKey = keyof typeof buckets;
export type BucketId = (typeof buckets)[BucketKey]["id"];
