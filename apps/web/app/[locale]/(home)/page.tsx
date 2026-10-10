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
import { Link } from "@repo/internationalization/navigation";
import {
  charity,
  events,
  journal,
  localized,
  programmes,
} from "@repo/sal-data";
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

  const [nextEvents, pieces, campaigns, progress, calls, allProgrammes] =
    await Promise.all([
      readPublished(
        ["events"],
        (c) => events.publicEvents(c, { limit: 3 }),
        []
      ),
      readPublished(["journal"], (c) => journal.latestPieces(c, 3), []),
      readPublished(["charity"], (c) => charity.activeCampaigns(c), []),
      readPublished(["charity"], (c) => charity.campaignProgress(c), []),
      readPublished(["journal"], (c) => journal.openCalls(c), []),
      readPublished(["programmes"], (c) => programmes.programmes(c), []),
    ]);
  // The flagship programs (not the regular formats), for "What we do".
  const flagship = (allProgrammes ?? []).filter(
    (p) => p.is_active && p.kind !== "format"
  );
  const campaign = campaigns?.[0];
  const meter = campaign
    ? progress.find((p) => p.campaign_id === campaign.id)
    : undefined;

  const heading = "type-heading frame-b pb-2";

  return (
    <>
      <section className="frame-b">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 sm:py-24">
          {/* The header already carries the lockup on phones. */}
          <div className="hidden sm:block">
            <BrandLogo height={96} locale={locale} variant="bilingual" />
          </div>
          <h1 className="type-display max-w-4xl">{t("title")}</h1>
          <p className="type-lede max-w-2xl">{t("lede")}</p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Button asChild size="lg">
              <a href={`${project.hosts.app}/${locale}/sign-up`}>{t("join")}</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/events">{t("allEvents")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-16 px-4 py-16 lg:grid-cols-2">
        {flagship.length > 0 ? (
          <section
            aria-labelledby="what-we-do"
            className="grid content-start gap-6 lg:col-span-2"
          >
            <div className="frame-b flex flex-wrap items-baseline justify-between gap-4 pb-2">
              <h2 className="type-heading" id="what-we-do">
                {t("whatWeDo")}
              </h2>
              <Link
                className="type-label text-xs underline underline-offset-4"
                href="/programs"
              >
                {t("allPrograms")}
              </Link>
            </div>
            <ul className="grid gap-gap sm:grid-cols-2 lg:grid-cols-4">
              {flagship.map((p) => (
                <li key={p.id}>
                  <Link
                    className="frame press grid h-full content-start gap-2 bg-surface-tint p-card-padding shadow-offset hover:bg-surface"
                    href={p.slug === "journal" ? "/journal" : "/programs"}
                  >
                    <h3 className="type-subheading">
                      {localized(p, "name", locale)}
                    </h3>
                    {localized(p, "summary", locale) ? (
                      <p className="type-body">
                        {localized(p, "summary", locale)}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {(nextEvents ?? []).length > 0 ? (
          <section
            aria-labelledby="next-events"
            className="grid content-start gap-6 lg:col-span-2"
          >
            <h2 className={heading} id="next-events">
              {t("nextEvents")}
            </h2>
            <ul className="grid gap-6 md:grid-cols-3">
              {(nextEvents ?? []).map((event) => (
                <li key={event.id}>
                  <Link
                    className="frame press grid h-full content-start gap-2 bg-surface p-card-padding shadow-offset hover:bg-surface-tint"
                    href={`/events/${event.slug}`}
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
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {(pieces ?? []).length > 0 ? (
          <section
            aria-labelledby="latest-journal"
            className="grid content-start gap-4"
          >
            <h2 className={heading} id="latest-journal">
              {t("latestJournal")}
            </h2>
            <ul className="grid">
              {(pieces ?? []).map((piece) => (
                <li className="border-rule border-b py-4" key={piece.id}>
                  <Link
                    className="grid gap-1 hover:underline"
                    href={`/journal/pieces/${piece.slug}`}
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
                  </Link>
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
            <h2 className={heading} id="warmth">
              {t("warmth")}
            </h2>
            <SalCard className="shadow-offset">
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
                  className="h-3 w-full accent-[var(--title)]"
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
            <h2 className={heading} id="open-calls">
              {t("openCalls")}
            </h2>
            <ul className="grid">
              {(calls ?? []).map((call) => (
                <li className="border-rule border-b py-4" key={call.id}>
                  <Link className="grid gap-1 hover:underline" href="/journal">
                    <span className="type-subheading">
                      {localized(call, "title", locale)}
                    </span>
                    <span className="type-caption">
                      {t("closes", {
                        date: formatLongDate(call.closes_at, locale),
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="join" className="band frame-t">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16">
          <h2 className="font-bold text-3xl sm:text-4xl" id="join">
            {t("join")}
          </h2>
          <p className="max-w-2xl text-lg">{t("joinBody")}</p>
          <Button
            asChild
            className="justify-self-start bg-on-band text-band hover:bg-on-band/90"
            size="lg"
          >
            <a href={`${project.hosts.app}/${locale}/sign-up`}>{t("join")}</a>
          </Button>
        </div>
      </section>
    </>
  );
};

export default Home;
