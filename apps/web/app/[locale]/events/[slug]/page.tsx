import { project } from "@repo/config";
import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "@repo/internationalization";
import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { events, localized, sanitizeRichText } from "@repo/sal-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { eventLd, JsonLd } from "@/lib/json-ld";
import { mediaUrl } from "@/lib/media";
import { localizedMetadata } from "@/lib/metadata";
import { readPublished } from "@/lib/supabase";

interface EventProps {
  readonly params: Promise<{ locale: Locale; slug: string }>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Rendered on first request, then cached until an event is published.
export const generateStaticParams = () => [];

type PublicEvent = Awaited<ReturnType<typeof events.publicEvent>>;

const load = (slug: string): Promise<PublicEvent | null> =>
  SLUG.test(slug)
    ? readPublished(["events"], (c) => events.publicEvent(c, slug), null)
    : Promise.resolve(null);

export const generateMetadata = async ({
  params,
}: EventProps): Promise<Metadata> => {
  const { locale, slug } = await params;
  const event = await load(slug);
  if (!event) {
    return {};
  }
  return localizedMetadata(locale, `/events/${event.slug}`, {
    description: localized(event, "summary", locale),
    image: mediaUrl(event.image_path) ?? undefined,
    title: localized(event, "title", locale),
  });
};

const EventPage = async ({ params }: EventProps) => {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const event = await load(slug);
  if (!event) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "web.events" });
  const body = localized(event, "body", locale);
  const image = mediaUrl(event.image_path);
  const cancelled = event.status === "cancelled";
  const upcoming = new Date(event.starts_at).getTime() > Date.now();

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-16">
      <JsonLd
        data={eventLd(locale, {
          ends_at: event.ends_at,
          image,
          name: localized(event, "title", locale),
          slug: event.slug,
          starts_at: event.starts_at,
          status: event.status,
          summary: localized(event, "summary", locale),
          venue: localized(event, "venue", locale),
        })}
      />
      <Link
        className="type-caption underline underline-offset-4"
        href="/events"
      >
        {t("all")}
      </Link>
      <header className="grid gap-3">
        <p className="type-kicker">
          {formatLongDate(event.starts_at, locale)} ·{" "}
          {formatClock(event.starts_at, locale)}
          {event.ends_at ? ` – ${formatClock(event.ends_at, locale)}` : ""}
        </p>
        <h1 className="type-display">{localized(event, "title", locale)}</h1>
        {localized(event, "venue", locale) ? (
          <p className="type-body">{localized(event, "venue", locale)}</p>
        ) : null}
      </header>
      {cancelled ? (
        <p
          className="type-body rounded-card border-accent-line border-s-4 bg-surface-tint p-4"
          role="status"
        >
          {t("cancelled")}
        </p>
      ) : null}
      {image ? (
        // biome-ignore lint/performance/noImgElement: a published image from the media bucket
        <img
          alt=""
          className="w-full rounded-card"
          height={630}
          src={image}
          width={1200}
        />
      ) : null}
      {localized(event, "summary", locale) ? (
        <p className="type-lede">{localized(event, "summary", locale)}</p>
      ) : null}
      {body ? (
        <div
          className="prose max-w-none"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with the one rich-text policy
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(body) }}
        />
      ) : null}
      {cancelled || !upcoming ? null : (
        <div className="flex flex-wrap gap-3">
          {event.rsvp_enabled ? (
            <Button asChild>
              <a href={`${project.hosts.app}/${locale}/events#${event.slug}`}>
                {t("rsvp")}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <a
              href={`${project.hosts.api}/calendar/events/${event.slug}.ics?lang=${locale}`}
            >
              {t("addToCalendar")}
            </a>
          </Button>
        </div>
      )}
      {event.rsvp_enabled && upcoming && !cancelled ? (
        <p className="type-caption">{t("rsvpHint")}</p>
      ) : null}
    </article>
  );
};

export default EventPage;
