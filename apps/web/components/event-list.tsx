import type { Locale } from "@repo/internationalization";
import { formatClock, formatLongDate } from "@repo/internationalization/format";
import { Link } from "@repo/internationalization/navigation";
import { localized } from "@repo/sal-data";

interface EventRow {
  id: string;
  slug: string;
  starts_at: string;
  summary_ar: string | null;
  summary_en: string | null;
  title_ar: string;
  title_en: string;
  venue_ar: string | null;
  venue_en: string | null;
  readonly [key: string]: unknown;
}

/** Events as framed cards (v5): date and time, title, venue, summary. */
export const EventList = ({
  events,
  locale,
}: {
  events: readonly EventRow[];
  locale: Locale;
}) => (
  <ul className="grid gap-6 md:grid-cols-2">
    {events.map((event) => (
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
          {localized(event, "venue", locale) ? (
            <p className="type-caption">{localized(event, "venue", locale)}</p>
          ) : null}
          {localized(event, "summary", locale) ? (
            <p className="type-body text-text-secondary">
              {localized(event, "summary", locale)}
            </p>
          ) : null}
        </Link>
      </li>
    ))}
  </ul>
);
