import { project } from "@repo/config";
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
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
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

/** A section heading with its "see all" link at the end of the line. */
const Block = ({
  children,
  href,
  id,
  more,
  title,
}: {
  children: ReactNode;
  href: string;
  id: string;
  more: string;
  title: string;
}) => (
  <section aria-labelledby={id} className="grid content-start gap-4">
    <div className="flex items-baseline justify-between gap-4 border-accent-line border-b pb-2">
      <h2 className="type-heading" id={id}>
        {title}
      </h2>
      <MoreLink href={href}>{more}</MoreLink>
    </div>
    {children}
  </section>
);

const MoreLink = ({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) => (
  <Link
    className="inline-flex shrink-0 items-center gap-1 text-sm underline-offset-4 hover:underline"
    href={href}
  >
    {children}
    <ChevronRightIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
  </Link>
);

const Home = async ({ params }: HomeProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.home" });
  const ta = await getTranslations({ locale, namespace: "web.about" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const tw = await getTranslations({ locale, namespace: "web.programmes" });
  const tn = await getTranslations({ locale, namespace: "web.nav" });

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
  const campaign = campaigns?.[0];
  const meter = campaign
    ? progress.find((p) => p.campaign_id === campaign.id)
    : undefined;
  const major = (allProgrammes ?? []).filter(
    (p) => p.is_active && p.kind !== "format"
  );
  const hasWaraq = (pieces ?? []).length > 0 || (calls ?? []).length > 0;
  const signUp = `${project.hosts.app}/${locale}/sign-up`;

  return (
    <>
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:py-24 lg:grid-cols-[3fr_2fr] lg:gap-16">
        <div className="grid content-start gap-6">
          <p className="type-kicker">{tc("society")}</p>
          <h1 className="type-display max-w-3xl text-balance">{t("title")}</h1>
          <p className="type-lede max-w-2xl">{t("lede")}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
            <Button asChild size="lg">
              <a href={signUp}>{t("join")}</a>
            </Button>
            <MoreLink href="/about">{t("about")}</MoreLink>
          </div>
        </div>
        <aside className="grid content-start gap-3 border-rule border-t pt-6 lg:border-s lg:border-t-0 lg:ps-10 lg:pt-2">
          <p className="type-kicker">{ta("mottoTitle")}</p>
          <p className="text-lg text-text-secondary leading-relaxed">
            {ta("mottoNote")}
          </p>
        </aside>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-16 px-4 pb-20 lg:grid-cols-2 lg:gap-x-16">
        <div className="grid content-start gap-16">
          <Block
            href="/events"
            id="next-events"
            more={t("allEvents")}
            title={t("nextEvents")}
          >
            {(nextEvents ?? []).length === 0 ? (
              <p className="type-body text-text-secondary">{t("noEvents")}</p>
            ) : (
              <ul className="grid">
                {(nextEvents ?? []).map((event) => (
                  <li className="border-rule border-b py-4" key={event.id}>
                    <Link
                      className="group grid gap-1"
                      href={`/events/${event.slug}`}
                    >
                      <span className="type-caption">
                        {formatLongDate(event.starts_at, locale)} ·{" "}
                        {formatClock(event.starts_at, locale)}
                      </span>
                      <span className="type-subheading underline-offset-4 group-hover:underline">
                        {localized(event, "title", locale)}
                      </span>
                      {localized(event, "summary", locale) ? (
                        <span className="type-body text-text-secondary">
                          {localized(event, "summary", locale)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {hasWaraq ? (
            <Block
              href="/waraq"
              id="latest-waraq"
              more={tw("journal")}
              title={t("latestWaraq")}
            >
              {(calls ?? []).map((call) => (
                <SalCard key={call.id}>
                  <p className="type-kicker">{t("openCalls")}</p>
                  <p className="type-subheading">
                    {localized(call, "title", locale)}
                  </p>
                  <p className="type-caption">
                    {formatLongDate(call.closes_at, locale)}
                  </p>
                </SalCard>
              ))}
              {(pieces ?? []).length > 0 ? (
                <ul className="grid">
                  {(pieces ?? []).map((piece) => (
                    <li className="border-rule border-b py-4" key={piece.id}>
                      <Link
                        className="group grid gap-1"
                        href={`/waraq/pieces/${piece.slug}`}
                      >
                        <span
                          className="type-subheading underline-offset-4 group-hover:underline"
                          lang={piece.language === "ar" ? "ar" : undefined}
                        >
                          {localized(piece, "title", locale)}
                        </span>
                        {piece.contributor ? (
                          <span className="type-caption">
                            {localized(piece.contributor, "name", locale)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Block>
          ) : null}
          {campaign && meter ? (
            <Block
              href="/give"
              id="warmth"
              more={tn("give")}
              title={t("warmth")}
            >
              <SalCard>
                <p className="type-subheading">
                  {localized(campaign, "title", locale)}
                </p>
                <p className="font-bold text-5xl text-title">
                  {formatNumber(meter.units)}
                </p>
                <p className="type-body">
                  {localized(campaign, "unit_label", locale)}
                </p>
                {meter.target_units ? (
                  <div aria-hidden="true" className="h-2 w-full bg-surface">
                    <div
                      className="h-full bg-title"
                      style={{
                        width: `${Math.min(100, (meter.units / meter.target_units) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null}
                <p className="type-caption">
                  {formatIqd(meter.counted_iqd, locale)}
                </p>
              </SalCard>
            </Block>
          ) : null}
        </div>
        {major.length > 0 ? (
          <Block
            href="/programmes"
            id="programmes"
            more={t("allProgrammes")}
            title={t("programmes")}
          >
            <ul className="grid">
              {major.map((p) => (
                <li className="border-rule border-b py-4" key={p.id}>
                  <Link
                    className="group grid gap-1"
                    href={p.slug === "waraq" ? "/waraq" : "/programmes"}
                  >
                    <span className="type-subheading underline-offset-4 group-hover:underline">
                      {localized(p, "name", locale)}
                    </span>
                    {localized(p, "summary", locale) ? (
                      <span className="type-body text-text-secondary">
                        {localized(p, "summary", locale)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}
      </div>

      <section aria-labelledby="join" className="band">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-14">
          <div className="grid gap-2">
            <h2 className="font-bold text-3xl" id="join">
              {t("join")}
            </h2>
            <p className="text-lg">{t("joinBody")}</p>
          </div>
          <Button
            asChild
            className="bg-on-band text-band hover:bg-on-band/90"
            size="lg"
          >
            <a href={signUp}>{t("join")}</a>
          </Button>
        </div>
      </section>
    </>
  );
};

export default Home;
