import { TZDate } from "@date-fns/tz";
import { project } from "@repo/config";
import {
  defaultLocale,
  isLocale,
  type Locale,
  localeDefinitions,
} from "./config";

/**
 * Locale-aware formatting with the project's regional defaults: the
 * Asia/Baghdad time zone, the Gregorian calendar (Iraqi month names in
 * Arabic) and Western or Arabic-Indic digits per project.json.
 *
 * Store timestamps in UTC (timestamptz) and format them with these helpers.
 */

export const TIME_ZONE = project.region.timeZone;
export const CURRENCY = project.region.currency;
/** 6 = Saturday, the first day of the week in Iraq. */
export const WEEK_STARTS_ON = project.region.weekStartsOn as
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6;

type DateInput = Date | string | number;

const toDate = (value: DateInput) =>
  value instanceof Date ? value : new Date(value);

/** BCP 47 tag with calendar and numbering system, e.g. ar-IQ-u-ca-gregory-nu-latn. */
export const intlLocale = (locale: string = defaultLocale) => {
  const base = isLocale(locale) ? localeDefinitions[locale].intl : locale;
  return `${base}-u-ca-gregory-nu-${project.region.numberingSystem}`;
};

export const formatDate = (
  value: DateInput,
  locale: Locale = defaultLocale,
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "medium"
) =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle,
    timeZone: TIME_ZONE,
  }).format(toDate(value));

export const formatDateTime = (
  value: DateInput,
  locale: Locale = defaultLocale
) =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(toDate(value));

export const formatTime = (value: DateInput, locale: Locale = defaultLocale) =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(toDate(value));

/**
 * Calendar labels for date pickers, whose dates are local (browser) days:
 * "تشرين الأول 2026" / "October 2026" and short weekday names. Formatted
 * without a time zone so the local day never shifts.
 */
export const formatMonthYear = (value: Date, locale: Locale = defaultLocale) =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
  }).format(value);

export const formatWeekday = (
  value: Date,
  locale: Locale = defaultLocale,
  weekday: "long" | "short" | "narrow" = "short"
) => new Intl.DateTimeFormat(intlLocale(locale), { weekday }).format(value);

/** A local calendar day ("15 October 2026"), without time-zone conversion. */
export const formatCalendarDate = (
  value: Date,
  locale: Locale = defaultLocale
) =>
  new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long" }).format(
    value
  );

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

/** "3 days ago", "in 2 hours", "منذ يومين" … */
export const formatRelativeTime = (
  value: DateInput,
  locale: Locale = defaultLocale,
  now: DateInput = new Date()
) => {
  const seconds = (toDate(value).getTime() - toDate(now).getTime()) / 1000;
  const [unit, size] =
    RELATIVE_UNITS.find(([, length]) => Math.abs(seconds) >= length) ??
    RELATIVE_UNITS.at(-1) ??
    (["second", 1] as const);

  return new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  }).format(Math.round(seconds / size), unit);
};

export const formatNumber = (
  value: number,
  locale: Locale = defaultLocale,
  options?: Intl.NumberFormatOptions
) => new Intl.NumberFormat(intlLocale(locale), options).format(value);

/** Money in whole units of the currency (IQD has no minor unit in practice). */
export const formatCurrency = (
  amount: number,
  locale: Locale = defaultLocale,
  currency: string = CURRENCY
) =>
  new Intl.NumberFormat(intlLocale(locale), {
    currency,
    maximumFractionDigits: currency === "IQD" ? 0 : undefined,
    style: "currency",
  }).format(amount);

/**
 * A date in the project time zone, for date-fns calculations such as start of
 * day or week in Baghdad rather than in the server's or browser's zone.
 */
export const inProjectTimeZone = (value: DateInput) =>
  new TZDate(toDate(value), TIME_ZONE);
