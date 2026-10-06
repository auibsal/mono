import type { Locale } from "@repo/internationalization";
import { formatNumber } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { journal, localized } from "@repo/sal-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PieceList } from "@/components/piece-list";
import { mediaUrl } from "@/lib/media";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface IssueProps {
  readonly params: Promise<{ issue: string; locale: Locale }>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
type Issue = Awaited<ReturnType<typeof journal.issueBySlug>>;

export const generateStaticParams = () => [];

const load = (slug: string): Promise<Issue | null> =>
  SLUG.test(slug)
    ? readPublished(["journal"], (c) => journal.issueBySlug(c, slug), null)
    : Promise.resolve(null);

export const generateMetadata = async ({
  params,
}: IssueProps): Promise<Metadata> => {
  const { issue: slug, locale } = await params;
  const issue = await load(slug);
  if (!issue) {
    return {};
  }
  return localizedMetadata(locale, `/waraq/${issue.slug}`, {
    description: localized(issue, "theme", locale),
    image: mediaUrl(issue.cover_path) ?? undefined,
    title: localized(issue, "title", locale),
  });
};

const IssuePage = async ({ params }: IssueProps) => {
  const { issue: slug, locale } = await params;
  setRequestLocale(locale);
  const issue = await load(slug);
  if (!issue) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "web.waraq" });
  const pieces = await readPublished(
    ["journal"],
    (c) => journal.piecesInIssue(c, issue.id),
    []
  );
  const cover = mediaUrl(issue.cover_path);
  const pdf = mediaUrl(issue.pdf_path);
  const note = localized(issue, "editors_note", locale);

  return (
    <article className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-16">
      <Link className="type-caption underline underline-offset-4" href="/waraq">
        {t("title")}
      </Link>
      <header className="grid gap-3">
        <p className="type-kicker">
          {t("volumeNumber", {
            number: formatNumber(issue.number, locale),
            volume: formatNumber(issue.volume, locale),
          })}
        </p>
        <h1 className="type-display">{localized(issue, "title", locale)}</h1>
        {localized(issue, "theme", locale) ? (
          <p className="type-lede">{localized(issue, "theme", locale)}</p>
        ) : null}
      </header>
      {cover ? (
        // biome-ignore lint/performance/noImgElement: a published image from the media bucket
        <img
          alt={t("coverAlt")}
          className="w-full max-w-md rounded-card"
          height={800}
          src={cover}
          width={600}
        />
      ) : null}
      {note ? (
        <section aria-labelledby="note" className="grid gap-3">
          <h2 className="type-heading" id="note">
            {t("editorsNote")}
          </h2>
          <p className="type-body whitespace-pre-wrap">{note}</p>
        </section>
      ) : null}
      {pdf ? (
        <a
          className="inline-flex h-10 items-center justify-self-start rounded-md border border-rule px-4 text-sm"
          href={pdf}
        >
          {t("pdf")}
        </a>
      ) : null}
      <section aria-labelledby="contents" className="grid gap-4">
        <h2
          className="type-heading border-accent-line border-b pb-2"
          id="contents"
        >
          {t("inThisIssue")}
        </h2>
        <PieceList locale={locale} pieces={pieces ?? []} />
      </section>
    </article>
  );
};

export default IssuePage;
