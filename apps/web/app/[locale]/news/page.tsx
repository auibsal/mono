import { formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { content, localized } from "@repo/sal-data";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/section";
import { type LocaleParams, sectionMetadata } from "@/lib/page";
import { readPublished } from "@/lib/supabase";

export const generateMetadata = sectionMetadata("web.news", "/news");

const NewsPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.news" });
  const posts: Awaited<ReturnType<typeof content.publishedNews>> =
    await readPublished(["news"], (c) => content.publishedNews(c, 50), []);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />
      {(posts ?? []).length === 0 ? (
        <p className="type-body text-text-secondary">{t("none")}</p>
      ) : (
        <ul className="grid gap-6">
          {(posts ?? []).map((post) => (
            <li className="grid gap-1 border-rule border-b pb-5" key={post.id}>
              {post.published_at ? (
                <p className="type-kicker">
                  {formatLongDate(post.published_at, locale)}
                </p>
              ) : null}
              <h2 className="type-subheading">
                <Link
                  className="underline-offset-4 hover:underline"
                  href={`/news/${post.slug}`}
                >
                  {localized(post, "title", locale)}
                </Link>
              </h2>
              {localized(post, "excerpt", locale) ? (
                <p className="type-body text-text-secondary">
                  {localized(post, "excerpt", locale)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NewsPage;
