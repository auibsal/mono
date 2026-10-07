/**
 * A small iCalendar (RFC 5545) reader for public event feeds: VEVENTs with
 * UID, SUMMARY, LOCATION, URL, DTSTART and DTEND. Times with a TZID are
 * read in that zone; floating times are taken as Baghdad time.
 */
export interface FeedEvent {
  allDay: boolean;
  end: string | null;
  location: string | null;
  start: string;
  title: string;
  uid: string;
  url: string | null;
}

const FOLDED = /\r?\n[ \t]/g;
const LINES = /\r?\n/;
const DATE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;
const TZID = /TZID=([^;:]+)/;

const unescapeText = (value: string) =>
  value
    .replace(/\\n/gi, "\n")
    .replace(/\\([,;\\])/g, "$1")
    .trim();

/** Offset of a time zone at an instant, in minutes (e.g. +180 for Baghdad). */
const offsetMinutes = (zone: string, at: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: zone,
    year: "numeric",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((local - at.getTime()) / 60_000);
};

const toInstant = (
  value: string,
  zone: string | undefined
): { allDay: boolean; iso: string } | null => {
  const date = DATE.exec(value);
  if (date) {
    const [, y, m, d] = date;
    return { allDay: true, iso: `${y}-${m}-${d}T00:00:00.000Z` };
  }
  const time = DATE_TIME.exec(value);
  if (!time) {
    return null;
  }
  const [, y, mo, d, h, mi, s, z] = time;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (z) {
    return { allDay: false, iso: new Date(naive).toISOString() };
  }
  const tz = zone ?? "Asia/Baghdad";
  let offset: number;
  try {
    offset = offsetMinutes(tz, new Date(naive));
  } catch {
    offset = offsetMinutes("Asia/Baghdad", new Date(naive));
  }
  return {
    allDay: false,
    iso: new Date(naive - offset * 60_000).toISOString(),
  };
};

interface Field {
  params: string;
  value: string;
}
type Fields = Map<string, Field>;

const zoneOf = (field: Field) => TZID.exec(field.params)?.[1];

const optional = (fields: Fields, name: string) => {
  const value = fields.get(name)?.value;
  return value ? unescapeText(value) || null : null;
};

const toEvent = (fields: Fields): FeedEvent | null => {
  const startField = fields.get("DTSTART");
  const endField = fields.get("DTEND");
  const uid = fields.get("UID")?.value.trim();
  const title = unescapeText(fields.get("SUMMARY")?.value ?? "");
  const start = startField
    ? toInstant(startField.value, zoneOf(startField))
    : null;
  if (!(uid && title && start)) {
    return null;
  }
  const end = endField ? toInstant(endField.value, zoneOf(endField)) : null;
  return {
    allDay: start.allDay,
    end: end && end.iso >= start.iso ? end.iso : null,
    location: optional(fields, "LOCATION"),
    start: start.iso,
    title: title.slice(0, 500),
    uid: uid.slice(0, 500),
    url: fields.get("URL")?.value.trim() || null,
  };
};

const readField = (line: string): [string, Field] | null => {
  const colon = line.indexOf(":");
  if (colon < 0) {
    return null;
  }
  const [name = "", ...params] = line.slice(0, colon).split(";");
  return [
    name.toUpperCase(),
    { params: params.join(";"), value: line.slice(colon + 1) },
  ];
};

export const parseIcal = (text: string): FeedEvent[] => {
  const events: FeedEvent[] = [];
  let current: Fields | null = null;
  for (const line of text.replace(FOLDED, "").split(LINES)) {
    if (line === "BEGIN:VEVENT") {
      current = new Map();
    } else if (line === "END:VEVENT") {
      const event = current ? toEvent(current) : null;
      if (event) {
        events.push(event);
      }
      current = null;
    } else if (current) {
      const field = readField(line);
      if (field) {
        current.set(field[0], field[1]);
      }
    }
  }
  return events;
};
