"use client";

import { useAuth } from "@repo/auth/provider";
import { unwrap } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * On a record written in the team's Notion workspace (core.notion_links):
 * says so and links to the page, since publishing from Notion again
 * replaces what is edited here.
 */
export const NotionManaged = ({
  kind,
  recordId,
}: {
  kind: "event" | "news";
  recordId: string | null;
}) => {
  const t = useTranslations("nexus.admin.notion");
  const tc = useTranslations("common");
  const { supabase } = useAuth();
  const link = useQuery({
    enabled: Boolean(recordId),
    queryFn: async () =>
      unwrap(
        await supabase
          .schema("core")
          .from("notion_links")
          .select("notion_page_id")
          .eq("kind", kind)
          .eq("record_key", recordId ?? "")
          .maybeSingle()
      ),
    queryKey: ["notion-link", kind, recordId],
  });
  if (!link.data) {
    return null;
  }
  return (
    <p className="frame bg-surface-tint p-4 text-sm" role="note">
      {t(kind === "event" ? "event" : "news")}{" "}
      <a
        className="inline-flex items-center gap-1 underline underline-offset-4"
        href={`https://www.notion.so/${link.data.notion_page_id}`}
        rel="noopener"
        target="_blank"
      >
        {t("open")}
        <ExternalLink aria-label={tc("externalLink")} className="size-3.5" />
      </a>
    </p>
  );
};
