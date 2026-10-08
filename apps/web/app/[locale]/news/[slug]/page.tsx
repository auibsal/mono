import type { Locale } from "@repo/internationalization";
import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { content, localized, sanitizeRichText } from "@repo/sal-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { mediaUrl } from "@/lib/media";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface NewsProps {
  readonly params: Promise<{ locale: Locale; slug: string }>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
type Post = Awaited<ReturnType<typeof content.newsBySlug>>;

export const generateStaticParams = () => [];

const load = (slug: string): Promise<Post | null> =>
  SLUG.test(slug)
    ? readPublished(["news"], (c) => content.newsBySlug(c, slug), null)
    : Promise.resolve(null);

export const generateMetadata = async ({
  params,
}: NewsProps): Promise<Metadata> => {
  const { locale, slug } = await params;
  const post = await load(slug);
  if (!post) {
    return {};
  }
  return localizedMetadata(locale, `/news/${post.slug}`, {
    description: localized(post, "excerpt", locale),
    image: mediaUrl(post.cover_path) ?? undefined,
    kicker: formatLongDate(post.published_at ?? new Date(), locale),
    title: localized(post, "title", locale),
  });
};

const NewsPost = async ({ params }: NewsProps) => {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await load(slug);
  if (!post) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "web.news" });
  const body = localized(post, "body", locale);
  const cover = mediaUrl(post.cover_path);

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-16">
      <Link className="type-caption underline underline-offset-4" href="/news">
        {t("all")}
      </Link>
      <header className="grid gap-3">
        {post.published_at ? (
          <p className="type-kicker">
            {formatLongDate(post.published_at, locale)}
          </p>
        ) : null}
        <h1 className="type-display">{localized(post, "title", locale)}</h1>
        {localized(post, "excerpt", locale) ? (
          <p className="type-lede">{localized(post, "excerpt", locale)}</p>
        ) : null}
      </header>
      {cover ? (
        // biome-ignore lint/performance/noImgElement: a published image from the media bucket
        <img
          alt=""
          className="w-full rounded-card"
          height={630}
          src={cover}
          width={1200}
        />
      ) : null}
      {body ? (
        <div
          className="prose max-w-none"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with the one rich-text policy
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }}
        />
      ) : null}
    </article>
  );
};

export default NewsPost;
