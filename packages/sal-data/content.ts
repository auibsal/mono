import { type Client, unwrap } from "./client";

export type SearchKind = "document" | "event" | "news" | "piece";

/** Published-only search across events, news, Waraq pieces and documents. */
export const search = async (client: Client, query: string, limit = 30) =>
  query.trim().length < 2
    ? []
    : (unwrap(
        await client
          .schema("content")
          .rpc("search", { max_results: limit, query })
      ) ?? []);

export const publishedNews = async (client: Client, limit = 20) =>
  unwrap(
    await client
      .schema("content")
      .from("news_posts")
      .select(
        "id, slug, title_en, title_ar, excerpt_en, excerpt_ar, cover_path, published_at"
      )
      .order("published_at", { ascending: false })
      .limit(limit)
  );

export const publicSetting = async (client: Client, key: string) =>
  unwrap(
    await client
      .schema("core")
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle()
  )?.value ?? null;
