import { project } from "@repo/config";
import type { Locale } from "@repo/internationalization";
import { events } from "@repo/sal-data";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EventList } from "@/components/event-list";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

const HTTP_SCHEME = /^https?:/;

interface EventsProps {
  readonly params: Promise<{ locale: Locale }>;
}

export const generateMetadata = async ({
  params,
}: EventsProps): Promise<Metadata> => {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "web.events" });
  return localizedMetadata(locale, "/events", {
    description: t("lede"),
    title: t("title"),
  });
};

const EventsPage = async ({ params }: EventsProps) => {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "web.events" });
  const [upcoming, past] = await Promise.all([
    readPublished(["events"], (c) => events.publicEvents(c), []),
    readPublished(["events"], (c) => events.pastPublicEvents(c), []),
  ]);
  const feed = `${project.hosts.api.replace(HTTP_SCHEME, "webcal:")}/calendar/sal.ics?lang=${locale}`;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-16">
      <header className="grid gap-4">
        <h1 className="type-display">{t("title")}</h1>
        <p className="type-lede max-w-3xl">{t("lede")}</p>
        <p className="type-body">
          <a className="underline underline-offset-4" href={feed}>
            {t("subscribe")}
          </a>{" "}
          <span className="text-text-secondary">{t("subscribeHint")}</span>
        </p>
      </header>
      <section aria-labelledby="upcoming" className="grid gap-4">
        <h2
          className="type-heading border-accent-line border-b pb-2"
          id="upcoming"
        >
          {t("upcoming")}
        </h2>
        {(upcoming ?? []).length === 0 ? (
          <p className="type-body text-text-secondary">{t("none")}</p>
        ) : (
          <EventList events={upcoming ?? []} locale={locale} />
        )}
      </section>
      {(past ?? []).length > 0 ? (
        <section aria-labelledby="past" className="grid gap-4">
          <h2
            className="type-heading border-accent-line border-b pb-2"
            id="past"
          >
            {t("past")}
          </h2>
          <EventList events={past ?? []} locale={locale} />
        </section>
      ) : null}
    </div>
  );
};

export default EventsPage;
