"use client";

import { useAuth } from "@repo/auth/provider";
import { Link } from "@repo/internationalization/navigation";
import { journal, localized, sanitizeRichText } from "@repo/sal-data";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useQueryParam } from "@/lib/use-query-param";
import { SectionSpinner } from "../states";

/** A published piece, members-only ones included (RLS checks membership). */
export const PieceReader = () => {
  const t = useTranslations("nexus.waraq");
  const tj = useTranslations("nexus.admin.journal");
  const locale = useLocale();
  const slug = useQueryParam("slug");
  const { supabase } = useAuth();
  const piece = useQuery({
    enabled: Boolean(slug),
    queryFn: () => journal.pieceBySlug(supabase, slug ?? ""),
    queryKey: ["piece", slug],
  });

  if (piece.isPending && slug) {
    return <SectionSpinner />;
  }
  const back = (
    <Link className="type-caption underline underline-offset-4" href="/waraq">
      {t("back")}
    </Link>
  );
  if (!piece.data) {
    return (
      <div className="grid gap-4">
        {back}
        <p>{t("pieceNotFound")}</p>
      </div>
    );
  }
  const texts = [
    { html: piece.data.body?.body_en, lang: "en" },
    { html: piece.data.body?.body_ar, lang: "ar" },
  ].filter((text): text is { html: string; lang: string } =>
    Boolean(text.html)
  );

  return (
    <article className="grid max-w-3xl gap-6">
      {back}
      <header className="grid gap-2">
        <p className="type-kicker">{tj(`categories.${piece.data.category}`)}</p>
        <h1 className="font-bold text-3xl">
          {localized(piece.data, "title", locale)}
        </h1>
        {piece.data.contributor ? (
          <p className="type-lede">
            {localized(piece.data.contributor, "name", locale)}
          </p>
        ) : null}
      </header>
      {texts.map((text) => (
        <div
          className="prose max-w-none"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with the one rich-text policy
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(text.html) }}
          dir={text.lang === "ar" ? "rtl" : "ltr"}
          key={text.lang}
          lang={text.lang}
        />
      ))}
    </article>
  );
};
