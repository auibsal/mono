import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { blog } from "@repo/cms";
import { Body } from "@repo/cms/components/body";
import { CodeBlock } from "@repo/cms/components/code-block";
import { Feed } from "@repo/cms/components/feed";
import { Image } from "@repo/cms/components/image";
import { TableOfContents } from "@repo/cms/components/toc";
import type { Locale } from "@repo/internationalization";
import { formatNumber } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { JsonLd } from "@repo/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/sidebar";
import { env } from "@/env";
import { localizedMetadata } from "@/lib/metadata";

const protocol = env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith("https")
  ? "https"
  : "http";
const url = new URL(`${protocol}://${env.VERCEL_PROJECT_PRODUCTION_URL}`);

interface BlogPostProperties {
  readonly params: Promise<{
    locale: Locale;
    slug: string;
  }>;
}

export const generateMetadata = async ({
  params,
}: BlogPostProperties): Promise<Metadata> => {
  const { locale, slug } = await params;
  const post = await blog.getPost(slug);

  if (!post) {
    return {};
  }

  return localizedMetadata(locale, `/blog/${slug}`, {
    description: post.description,
    image: post.image.url,
    title: post._title,
  });
};

export const generateStaticParams = async (): Promise<{ slug: string }[]> => {
  const posts = await blog.getPosts();

  return posts.map(({ _slug }) => ({ slug: _slug }));
};

const BlogPost = async ({ params }: BlogPostProperties) => {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("web.blog");
  const labels = {
    back: t("back"),
    published: t("published"),
    sections: t("sections"),
    tags: t("tags"),
  };
  const readingTime = (minutes: number) =>
    t("readingTime", {
      count: minutes,
      minutes: formatNumber(minutes, locale),
    });

  return (
    <Feed queries={[blog.postQuery(slug)]}>
      {async ([data]) => {
        "use server";

        const page = data.blog.posts.item;

        if (!page) {
          notFound();
        }

        return (
          <>
            <JsonLd
              code={{
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                author: page.authors.at(0)?._title,
                dateModified: page.date,
                datePublished: page.date,
                description: page.description,
                headline: page._title,
                image: page.image.url,
                isAccessibleForFree: true,
                mainEntityOfPage: {
                  "@id": new URL(`/blog/${page._slug}`, url).toString(),
                  "@type": "WebPage",
                },
              }}
            />
            <div className="container mx-auto py-16">
              <Link
                className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm focus:underline focus:outline-none"
                href="/blog"
              >
                <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
                {labels.back}
              </Link>
              <div className="mt-16 flex flex-col items-start gap-8 sm:flex-row">
                <div className="sm:flex-1">
                  <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <h1 className="scroll-m-20 text-balance font-extrabold text-4xl tracking-tight lg:text-5xl">
                      {page._title}
                    </h1>
                    <p className="text-balance leading-7 [&:not(:first-child)]:mt-6">
                      {page.description}
                    </p>
                    {page.image ? (
                      <Image
                        alt={page.image.alt ?? ""}
                        className="my-16 h-full w-full rounded-xl"
                        height={page.image.height}
                        priority
                        src={page.image.url}
                        width={page.image.width}
                      />
                    ) : null}
                    <div className="mx-auto max-w-prose">
                      <Body
                        components={{
                          pre: ({ code, language }) => (
                            <CodeBlock
                              snippets={[{ code, language }]}
                              theme="vesper"
                            />
                          ),
                        }}
                        content={page.body.json.content}
                      />
                    </div>
                  </div>
                </div>
                <div className="sticky top-24 hidden shrink-0 md:block">
                  <Sidebar
                    date={new Date(page.date)}
                    labels={labels}
                    locale={locale}
                    readingTime={readingTime(page.body.readingTime)}
                    toc={<TableOfContents data={page.body.json.toc} />}
                  />
                </div>
              </div>
            </div>
          </>
        );
      }}
    </Feed>
  );
};

export default BlogPost;
