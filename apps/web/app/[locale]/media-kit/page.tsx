import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Section } from "@/components/section";
import { type LocaleParams, sectionMetadata } from "@/lib/page";

export const generateMetadata = sectionMetadata("web.mediaKit", "/media-kit");

const LOGOS = [
  ["horizontal", "sal-lockup-horizontal.svg", false],
  ["horizontalReversed", "sal-lockup-horizontal-reversed.svg", true],
  ["stacked", "sal-lockup-stacked.svg", false],
  ["stackedReversed", "sal-lockup-stacked-reversed.svg", true],
  ["bilingual", "sal-lockup-bilingual.svg", false],
  ["bilingualReversed", "sal-lockup-bilingual-reversed.svg", true],
  ["symbol", "sal-symbol.svg", false],
  ["symbolWhite", "sal-symbol-white.svg", true],
  ["avatar", "sal-avatar.svg", false],
] as const;

// The palette from brand/tokens.json (SAL v4).
const COLOURS = [
  ["Crimson", "#9c213e"],
  ["Crimson 700", "#7e1a32"],
  ["Crimson 100", "#ebcbd3"],
  ["Crimson 50", "#f7ecef"],
  ["Ink", "#273236"],
  ["White", "#ffffff"],
  ["Paper", "#faf7f5"],
] as const;

const MediaKitPage = async ({ params }: LocaleParams) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.mediaKit" });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-12 px-4 py-16">
      <PageHeader lede={t("lede")} title={t("title")} />

      <Section id="name" title={t("nameTitle")}>
        <p className="type-body">{t("name")}</p>
        <p className="type-body">{t("nameAr")}</p>
        <p className="type-body">{t("programmeLine")}</p>
      </Section>

      <Section id="about" title={t("aboutTitle")}>
        <p className="type-body">{t("about")}</p>
      </Section>

      <Section id="logos" title={t("logosTitle")}>
        <p className="type-body">{t("logosNote")}</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LOGOS.map(([key, file, reversed]) => (
            <li className="frame grid gap-3 bg-surface-tint p-4" key={key}>
              <div
                className="flex h-32 items-center justify-center rounded-card p-4"
                data-theme={reversed ? "dark" : "light"}
                style={{
                  background: reversed ? "var(--sal-ink)" : "var(--sal-white)",
                }}
              >
                {/* biome-ignore lint/performance/noImgElement: the logo file exactly as supplied */}
                <img
                  alt={t(`logos.${key}`)}
                  className="max-h-full w-auto"
                  height={96}
                  src={`/brand/${file}`}
                  width={192}
                />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">{t(`logos.${key}`)}</span>
                <a
                  className="text-sm underline underline-offset-4"
                  download={file}
                  href={`/brand/${file}`}
                >
                  {t("download")}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="colours" title={t("coloursTitle")}>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {COLOURS.map(([name, hex]) => (
            <li className="grid gap-2" key={hex}>
              <span
                aria-hidden="true"
                className="h-16 rounded-card border border-rule"
                style={{ background: hex }}
              />
              <span className="text-sm" dir="ltr" lang="en">
                {name}
              </span>
              <span className="type-code text-sm" dir="ltr">
                {hex}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="type-body">{t("contactPress")}</p>
    </div>
  );
};

export default MediaKitPage;
