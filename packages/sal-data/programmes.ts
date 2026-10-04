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

export const youtubeEmbedUrl = (youtubeId: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`;

export const sixWordsWall = async (client: Client, limit = 200) =>
  unwrap(await client.schema("programmes").rpc("six_words_wall", { max_results: limit })) ?? [];

export const programmes = async (client: Client) =>
  unwrap(await client.schema("core").from("programmes").select("*").order("sort"));
