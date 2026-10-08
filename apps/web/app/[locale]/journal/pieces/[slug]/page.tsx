import { project } from "@repo/config";
import type { Locale } from "@repo/internationalization";
import { formatNumber } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { journal, localized, sanitizeRichText } from "@repo/sal-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { articleLd, JsonLd } from "@/lib/json-ld";
import { mediaUrl } from "@/lib/media";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface PieceProps {
  readonly params: Promise<{ locale: Locale; slug: string }>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
type Piece = Awaited<ReturnType<typeof journal.pieceBySlug>>;

export const generateStaticParams = () => [];

const load = (slug: string): Promise<Piece | null> =>
  SLUG.test(slug)
    ? readPublished(["journal"], (c) => journal.pieceBySlug(c, slug), null)
    : Promise.resolve(null);

export const generateMetadata = async ({
  params,
}: PieceProps): Promise<Metadata> => {
  const { locale, slug } = await params;
  const piece = await load(slug);
  if (!piece) {
    return {};
  }
  return localizedMetadata(locale, `/journal/pieces/${piece.slug}`, {
    description: piece.contributor
      ? localized(piece.contributor, "name", locale)
      : "",
    image: mediaUrl(piece.image_path) ?? undefined,
    title: localized(piece, "title", locale),
  });
};

/** Both languages for a bilingual piece; otherwise the language it was written in. */
const bodies = (
  piece: NonNullable<Piece>
): { html: string; lang: "en" | "ar" }[] => {
  const out: { html: string; lang: "en" | "ar" }[] = [];
  if (piece.body?.body_en) {
    out.push({ html: piece.body.body_en, lang: "en" });
  }
  if (piece.body?.body_ar) {
    out.push({ html: piece.body.body_ar, lang: "ar" });
  }
  return out;
};

const PiecePage = async ({ params }: PieceProps) => {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const piece = await load(slug);
  if (!piece) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "web.journal" });
  const image = mediaUrl(piece.image_path);
  const credit = localized(piece, "credit", locale);
  const texts = bodies(piece);

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-16">
      <JsonLd
        data={articleLd(locale, {
          author: piece.contributor
            ? localized(piece.contributor, "name", locale)
            : null,
          image,
          path: `/journal/pieces/${piece.slug}`,
          publishedAt: piece.published_at,
          title: localized(piece, "title", locale),
        })}
      />
      {piece.issue ? (
        <Link
          className="type-caption underline underline-offset-4"
          href={`/journal/${piece.issue.slug}`}
        >
          {t("volumeNumber", {
            number: formatNumber(piece.issue.number, locale),
            volume: formatNumber(piece.issue.volume, locale),
          })}{" "}
          · {localized(piece.issue, "title", locale)}
        </Link>
      ) : null}
      <header className="grid gap-3">
        <p className="type-kicker">
          {t(`categories.${piece.category as "poetry"}`)}
        </p>
        <h1 className="type-display">{localized(piece, "title", locale)}</h1>
        {piece.contributor ? (
          <p className="type-lede">
            <Link
              className="underline-offset-4 hover:underline"
              href={`/journal/contributors/${piece.contributor.slug}`}
            >
              {localized(piece.contributor, "name", locale)}
            </Link>
          </p>
        ) : null}
        {credit ? <p className="type-caption">{credit}</p> : null}
      </header>
      {image ? (
        // biome-ignore lint/performance/noImgElement: a published image from the media bucket
        <img
          alt=""
          className="w-full rounded-card"
          height={900}
          src={image}
          width={1200}
        />
      ) : null}
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
      {piece.members_only && texts.length === 0 ? (
        <div className="frame grid gap-3 bg-surface-tint p-6">
          <p className="type-body">{t("membersOnlyBody")}</p>
          <a
            className="inline-flex h-10 items-center justify-self-start rounded-md bg-primary px-4 text-primary-foreground text-sm"
            href={`${project.hosts.app}/${locale}/journal/piece?slug=${piece.slug}`}
          >
            {t("readInNexus")}
          </a>
        </div>
      ) : null}
    </article>
  );
};

export default PiecePage;
