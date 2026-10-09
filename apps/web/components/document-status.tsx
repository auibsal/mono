import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import type { documents } from "@repo/sal-data";
import { getTranslations } from "next-intl/server";

/** The registry's status, stated plainly on every document page. */
export const DocumentStatus = async ({
  doc,
  locale,
}: {
  doc: Pick<documents.SalDocument, "adopted_on" | "ratification" | "status">;
  locale: Locale;
}) => {
  const t = await getTranslations({ locale, namespace: "web.documents" });
  let body = t("status.superseded");
  if (doc.status === "draft") {
    body = doc.ratification
      ? t("status.draftFor", {
          date: formatLongDate(doc.ratification, locale),
        })
      : t("status.draft");
  } else if (doc.status === "adopted") {
    body = doc.adopted_on
      ? t("status.adoptedOn", { date: formatLongDate(doc.adopted_on, locale) })
      : t("status.adopted");
  }
  return (
    <aside
      aria-label={t("statusLabel")}
      className="grid gap-1 rounded-card border-accent-line border-s-4 bg-surface-tint p-4"
    >
      <p className="type-kicker">
        {t(`statuses.${doc.status as documents.DocumentStatus}`)}
      </p>
      <p className="type-body">{body}</p>
    </aside>
  );
};
