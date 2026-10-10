import "server-only";

/**
 * A small client for the Notion API (https://developers.notion.com), enough
 * for the team-workspace sync. One integration token (NOTION_TOKEN, the
 * "SAL Platform" connection) acts for the workspace, never as a person.
 */
const BASE = "https://api.notion.com/v1";
export const NOTION_VERSION = "2026-03-11";
const MAX_RETRIES = 3;

export class NotionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Method = "GET" | "PATCH" | "POST";

export interface NotionUser {
  id: string;
  name?: string | null;
  object: "user";
  person?: { email?: string };
  type?: "bot" | "person";
}

export interface NotionPage {
  id: string;
  in_trash?: boolean;
  last_edited_by?: { id: string };
  last_edited_time: string;
  object: "page";
  properties: Record<string, NotionProperty>;
  url?: string;
}

/** A property value as the API returns it (only the parts we read). */
export interface NotionProperty {
  checkbox?: boolean;
  date?: {
    end: string | null;
    start: string;
    time_zone?: string | null;
  } | null;
  email?: string | null;
  files?: {
    external?: { url: string };
    file?: { url: string };
    name: string;
    type: "external" | "file";
  }[];
  multi_select?: { name: string }[];
  number?: number | null;
  people?: { id: string }[];
  relation?: { id: string }[];
  rich_text?: RichText[];
  select?: { name: string } | null;
  title?: RichText[];
  type: string;
  url?: string | null;
}

export interface RichText {
  annotations?: {
    bold?: boolean;
    code?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  href?: string | null;
  plain_text: string;
  type?: string;
}

export interface NotionBlock {
  has_children?: boolean;
  id: string;
  type: string;
  [key: string]: unknown;
}

interface List<T> {
  has_more: boolean;
  next_cursor: string | null;
  results: T[];
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const createNotion = (
  token: string,
  fetchImpl: typeof fetch = fetch
) => {
  const request = async <T>(
    method: Method,
    path: string,
    body?: object,
    attempt = 0
  ): Promise<T> => {
    const response = await fetchImpl(`${BASE}${path}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      method,
      signal: AbortSignal.timeout(20_000),
    });
    // Notion allows about three requests a second; it says how long to wait.
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const seconds = Number(response.headers.get("retry-after") ?? "1");
      await wait(Math.min(Number.isFinite(seconds) ? seconds : 1, 10) * 1000);
      return request<T>(method, path, body, attempt + 1);
    }
    const json = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    if (!response.ok) {
      throw new NotionError(
        response.status,
        json.code ?? "error",
        json.message ?? `HTTP ${response.status}`
      );
    }
    return json as T;
  };

  /** Every result of a paginated call, in order. */
  const all = async <T>(
    load: (cursor: string | undefined) => Promise<List<T>>
  ): Promise<T[]> => {
    const out: T[] = [];
    let cursor: string | undefined;
    do {
      // Pages depend on the previous cursor, so they load one at a time.
      // biome-ignore lint/performance/noAwaitInLoops: sequential pagination
      const page = await load(cursor);
      out.push(...page.results);
      cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return out;
  };

  return {
    /** A page's top-level blocks (its text). */
    blocks: (pageId: string) =>
      all<NotionBlock>((cursor) =>
        request(
          "GET",
          `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`
        )
      ),

    comment: (pageId: string, text: string) =>
      request("POST", "/comments", {
        parent: { page_id: pageId },
        rich_text: [{ text: { content: text.slice(0, 2000) }, type: "text" }],
      }),

    createPage: (dataSourceId: string, properties: object) =>
      request<NotionPage>("POST", "/pages", {
        parent: { data_source_id: dataSourceId, type: "data_source_id" },
        properties,
      }),
    /** Every page of a data source (database), optionally filtered. */
    query: (dataSourceId: string, filter?: object) =>
      all<NotionPage>((cursor) =>
        request("POST", `/data_sources/${dataSourceId}/query`, {
          filter,
          page_size: 100,
          start_cursor: cursor,
        })
      ),

    trashPage: (pageId: string) =>
      request<NotionPage>("PATCH", `/pages/${pageId}`, { in_trash: true }),

    updatePage: (pageId: string, properties: object) =>
      request<NotionPage>("PATCH", `/pages/${pageId}`, { properties }),

    user: (userId: string) => request<NotionUser>("GET", `/users/${userId}`),

    /** Workspace members and bots (guests are not listed by the API). */
    users: () =>
      all<NotionUser>((cursor) =>
        request(
          "GET",
          `/users?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`
        )
      ),
  };
};

export type Notion = ReturnType<typeof createNotion>;

/** Notion ids as stored here: 32 hex characters, no dashes. */
export const bareId = (id: string) => id.replaceAll("-", "").toLowerCase();

/** A link that opens the page in Notion. */
export const pageUrl = (id: string) => `https://www.notion.so/${bareId(id)}`;
