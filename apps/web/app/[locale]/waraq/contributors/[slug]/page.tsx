import type { Locale } from "@repo/internationalization";
import { Link } from "@repo/internationalization/navigation";
import { journal, localized } from "@repo/sal-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PieceList } from "@/components/piece-list";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface ContributorProps {
  readonly params: Promise<{ locale: Locale; slug: string }>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
type Contributor = Awaited<ReturnType<typeof journal.contributorBySlug>>;

export const generateStaticParams = () => [];

const load = (slug: string): Promise<Contributor | null> =>
  SLUG.test(slug)
    ? readPublished(
        ["journal"],
        (c) => journal.contributorBySlug(c, slug),
        null
      )
    : Promise.resolve(null);

export const generateMetadata = async ({
  params,
}: ContributorProps): Promise<Metadata> => {
  const { locale, slug } = await params;
  const contributor = await load(slug);
  if (!contributor) {
    return {};
  }
  return localizedMetadata(locale, `/waraq/contributors/${contributor.slug}`, {
    description: localized(contributor, "bio", locale),
    title: localized(contributor, "name", locale),
  });
};

const ContributorPage = async ({ params }: ContributorProps) => {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const contributor = await load(slug);
  if (!contributor || contributor.pieces.length === 0) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "web.waraq" });
  const bio = localized(contributor, "bio", locale);

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-16">
      <Link className="type-caption underline underline-offset-4" href="/waraq">
        {t("title")}
      </Link>
      <header className="grid gap-3">
        <p className="type-kicker">{t("contributor")}</p>
        <h1 className="type-display">
          {localized(contributor, "name", locale)}
        </h1>
        {bio ? <p className="type-lede whitespace-pre-wrap">{bio}</p> : null}
      </header>
      <section aria-labelledby="work" className="grid gap-4">
        <h2 className="type-heading border-accent-line border-b pb-2" id="work">
          {t("work")}
        </h2>
        <PieceList
          locale={locale}
          pieces={contributor.pieces}
          showContributor={false}
        />
      </section>
    </article>
  );
};

export default ContributorPage;
