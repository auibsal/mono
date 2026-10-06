import { env } from "@/env";

/** Public URL of an object in the media bucket (published images only). */
export const mediaUrl = (path: string | null | undefined) =>
  path && env.NEXT_PUBLIC_SUPABASE_URL
    ? `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`
    : null;
