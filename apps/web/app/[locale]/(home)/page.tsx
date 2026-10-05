import { project } from "@repo/config";
import { BrandLogo } from "@repo/design-system/components/brand-logo";
import { SalCard } from "@repo/design-system/components/sal/card";
import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "@repo/internationalization";
import {
  formatClock,
  formatIqd,
  formatLongDate,
  formatNumber,
} from "@repo/internationalization/format";
import { charity, events, journal, localized } from "@repo/sal-data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface HomeProps {
  readonly params: Promise<{ locale: Locale }>;
}

export const generateMetadata = async ({
  params,
}: HomeProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.home" });
  return localizedMetadata(locale, "/", {
    description: t("lede"),
    title: t("title"),
  });
};

const Home = async ({ params }: HomeProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.home" });

  const [nextEvents, pieces, campaigns, progress, calls] = await Promise.all([
    readPublished(["events"], (c) => events.publicEvents(c, { limit: 3 }), []),
    readPublished(["journal"], (c) => journal.latestPieces(c, 3), []),
    readPublished(["charity"], (c) => charity.activeCampaigns(c), []),
    readPublished(["charity"], (c) => charity.campaignProgress(c), []),
    readPublished(["journal"], (c) => journal.openCalls(c), []),
  ]);
  const campaign = campaigns?.[0];
  const meter = campaign
    ? progress.find((p) => p.campaign_id === campaign.id)
    : undefined;

  return (
    <>
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16">
        <BrandLogo height={96} locale={locale} variant="bilingual" />
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-2xl">{t("lede")}</p>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 lg:grid-cols-2">
        <section
          aria-labelledby="next-events"
          className="grid content-start gap-4"
        >
          <h2
            className="type-heading border-accent-line border-b pb-2"
            id="next-events"
          >
            {t("nextEvents")}
          </h2>
          {(nextEvents ?? []).length === 0 ? (
            <p className="type-body text-text-secondary">{t("noEvents")}</p>
          ) : null}
          <ul className="grid gap-4">
            {(nextEvents ?? []).map((event) => (
              <li
                className="grid gap-1 border-rule border-b pb-4"
                key={event.id}
              >
                <p className="type-kicker">
                  {formatLongDate(event.starts_at, locale)} ·{" "}
                  {formatClock(event.starts_at, locale)}
                </p>
                <h3 className="type-subheading">
                  {localized(event, "title", locale)}
                </h3>
                {localized(event, "summary", locale) ? (
                  <p className="type-body text-text-secondary">
                    {localized(event, "summary", locale)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {(pieces ?? []).length > 0 ? (
          <section
            aria-labelledby="latest-waraq"
            className="grid content-start gap-4"
          >
            <h2
              className="type-heading border-accent-line border-b pb-2"
              id="latest-waraq"
            >
              {t("latestWaraq")}
            </h2>
            <ul className="grid gap-4">
              {(pieces ?? []).map((piece) => (
                <li
                  className="grid gap-1 border-rule border-b pb-4"
                  key={piece.id}
                >
                  <h3
                    className="type-subheading"
                    lang={piece.language === "ar" ? "ar" : undefined}
                  >
                    {localized(piece, "title", locale)}
                  </h3>
                  {piece.contributor ? (
                    <p className="type-caption">
                      {localized(piece.contributor, "name", locale)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {campaign && meter ? (
          <section
            aria-labelledby="warmth"
            className="grid content-start gap-4"
          >
            <h2
              className="type-heading border-accent-line border-b pb-2"
              id="warmth"
            >
              {t("warmth")}
            </h2>
            <SalCard>
              <p className="type-subheading">
                {localized(campaign, "title", locale)}
              </p>
              <p className="type-display">{formatNumber(meter.units)}</p>
              <p className="type-body">
                {localized(campaign, "unit_label", locale)}
              </p>
              {meter.target_units ? (
                <progress
                  aria-label={t("warmth")}
                  className="h-2 w-full accent-[var(--title)]"
                  max={meter.target_units}
                  value={Math.min(meter.units, meter.target_units)}
                />
              ) : null}
              <p className="type-caption">
                {formatIqd(meter.counted_iqd, locale)}
              </p>
            </SalCard>
          </section>
        ) : null}

        {(calls ?? []).length > 0 ? (
          <section
            aria-labelledby="open-calls"
            className="grid content-start gap-4"
          >
            <h2
              className="type-heading border-accent-line border-b pb-2"
              id="open-calls"
            >
              {t("openCalls")}
            </h2>
            <ul className="grid gap-3">
              {(calls ?? []).map((call) => (
                <li key={call.id}>
                  <p className="type-subheading">
                    {localized(call, "title", locale)}
                  </p>
                  <p className="type-caption">
                    {formatLongDate(call.closes_at, locale)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="join" className="band">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-12">
          <h2 className="font-bold text-2xl" id="join">
            {t("join")}
          </h2>
          <p>{t("joinBody")}</p>
          <Button
            asChild
            className="justify-self-start bg-on-band text-band hover:bg-on-band/90"
          >
            <a href={`${project.hosts.app}/${locale}/sign-up`}>{t("join")}</a>
          </Button>
        </div>
      </section>
    </>
  );
};

export default Home;
