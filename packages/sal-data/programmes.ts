import { z } from "zod";
import { type Client, unwrap } from "./client";
import { wordCount } from "./membership";

export const sixWordsSchema = z.object({
  language: z.enum(["en", "ar"]),
  show_name: z.boolean().default(true),
  text: z
    .string()
    .trim()
    .max(200)
    .refine((v) => wordCount(v) === 6, { message: "six_words" }),
});

export const removalRequestSchema = z.object({
  content_url: z.url().max(2048).optional().or(z.literal("")),
  details: z.string().trim().min(1).max(4000),
  requester_email: z.email(),
  requester_name: z.string().trim().min(1).max(200),
});

export type RemovalRequestInput = z.infer<typeof removalRequestSchema>;

/** Side Quest care: removal requests are handled within 24 hours. */
export const REMOVAL_PROMISE_HOURS = 24;

export const youtubeEmbedUrl = (videoId: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;

export const sixWordsWall = async (client: Client, limit = 200) =>
  unwrap(
    await client
      .schema("programmes")
      .rpc("six_words_wall", { max_results: limit })
  ) ?? [];

export const programmes = async (client: Client) =>
  unwrap(
    await client.schema("core").from("programmes").select("*").order("sort")
  );

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

/** The 11-character video id from a YouTube link (or the id itself); else null. */
export const youtubeId = (value: string) => {
  const input = value.trim();
  if (YOUTUBE_ID.test(input)) {
    return input;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }
  const candidate =
    url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : (url.searchParams.get("v") ??
        url.pathname.split("/").filter(Boolean).at(-1) ??
        "");
  return YOUTUBE_ID.test(candidate) ? candidate : null;
};

const REEL_URL =
  /^https:\/\/(www\.)?(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)\//;

/** Mirrors the reels.url check in the database. */
export const isReelUrl = (value: string) => REEL_URL.test(value.trim());

export const removalStatuses = [
  "open",
  "in_progress",
  "removed",
  "declined",
  "closed",
] as const;

/** Hours and minutes until (positive) or past (negative) a due time. */
export const timeLeft = (dueAt: string, now = new Date()) => {
  const minutes = Math.round(
    (new Date(dueAt).getTime() - now.getTime()) / 60_000
  );
  const abs = Math.abs(minutes);
  return {
    hours: Math.floor(abs / 60),
    minutes: abs % 60,
    overdue: minutes < 0,
  };
};
