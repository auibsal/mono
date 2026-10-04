/**
 * Buckets created by supabase/migrations/…_storage.sql. Limits mirror the
 * bucket settings so uploads fail fast with a clear error before the
 * request is sent; the bucket enforces them either way.
 */
export const buckets = {
  /** Public profile pictures, under "<user id>/…"; only the owner writes. */
  avatars: {
    id: "avatars",
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
    public: true,
  },
  /** Private files under "<organization id>/…"; members read and write. */
  orgFiles: {
    id: "org-files",
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: undefined,
    public: false,
  },
} as const;

export type BucketKey = keyof typeof buckets;
export type BucketId = (typeof buckets)[BucketKey]["id"];
