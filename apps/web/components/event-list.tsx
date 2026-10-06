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

/** A plain list of events: date and time, title, venue, summary. */
export const EventList = ({
  events,
  locale,
}: {
  events: readonly EventRow[];
  locale: Locale;
}) => (
  <ul className="grid gap-4">
    {events.map((event) => (
      <li className="grid gap-1 border-rule border-b pb-4" key={event.id}>
        <p className="type-kicker">
          {formatLongDate(event.starts_at, locale)} ·{" "}
          {formatClock(event.starts_at, locale)}
        </p>
        <h3 className="type-subheading">
          <Link
            className="underline-offset-4 hover:underline"
            href={`/events/${event.slug}`}
          >
            {localized(event, "title", locale)}
          </Link>
        </h3>
        {localized(event, "venue", locale) ? (
          <p className="type-caption">{localized(event, "venue", locale)}</p>
        ) : null}
        {localized(event, "summary", locale) ? (
          <p className="type-body text-text-secondary">
            {localized(event, "summary", locale)}
          </p>
        ) : null}
      </li>
    ))}
  </ul>
);
