import { buttonVariants } from "@repo/design-system/components/ui/button";
import { Link } from "@repo/internationalization/navigation";
import { localized, programmes } from "@repo/sal-data";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { type LocaleParams, sectionMetadata } from "@/lib/page";
import { readPublished } from "@/lib/supabase";

export const generateMetadata = sectionMetadata("web.programmes", "/programs");

const ProgrammesPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.programmes" });
  const all: Awaited<ReturnType<typeof programmes.programmes>> =
    await readPublished(["programmes"], (c) => programmes.programmes(c), []);
  const rows = (all ?? []).filter((p) => p.is_active);
  const major = rows.filter((p) => p.kind !== "format");
  const regular = rows.filter((p) => p.kind === "format");

  const card = (p: (typeof rows)[number]) => (
    <li
      className="frame grid content-start gap-2 bg-surface-tint p-5"
      key={p.id}
    >
      <h3 className="type-subheading">{localized(p, "name", locale)}</h3>
      {localized(p, "summary", locale) ? (
        <p className="type-body">{localized(p, "summary", locale)}</p>
      ) : null}
      {p.slug === "journal" ? (
        <Link
          className="type-caption underline underline-offset-4"
          href="/journal"
        >
          {t("journal")}
        </Link>
      ) : null}
    </li>
  );

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-16">
      <header className="grid gap-4">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-3xl">{t("lede")}</p>
      </header>
      <section aria-labelledby="flagship" className="grid gap-4">
        <h2 className="type-heading frame-b pb-2" id="flagship">
          {t("major")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">{major.map(card)}</ul>
      </section>
      <section aria-labelledby="through-the-term" className="grid gap-4">
        <h2 className="type-heading frame-b pb-2" id="through-the-term">
          {t("regular")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regular.map(card)}
        </ul>
      </section>
      <Link
        className={buttonVariants({
          className: "justify-self-start",
          variant: "outline",
        })}
        href="/events"
      >
        {t("events")}
      </Link>
    </div>
  );
};

export default ProgrammesPage;
