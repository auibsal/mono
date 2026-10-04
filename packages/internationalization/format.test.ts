import { startOfDay } from "date-fns";
import { describe, expect, test } from "vitest";
import { getDirection } from "./config";
import {
  formatCalendarDate,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatRelativeTime,
  formatWeekday,
  inProjectTimeZone,
  intlLocale,
  WEEK_STARTS_ON,
} from "./format";

// 21:30 UTC on 3 October is already 4 October in Baghdad (UTC+3).
const lateEvening = new Date("2026-10-03T21:30:00Z");

describe("regional formatting", () => {
  test("uses the Gregorian calendar and Western digits", () => {
    expect(intlLocale("ar")).toBe("ar-IQ-u-ca-gregory-nu-latn");
  });

  test("formats dates in Baghdad time with Iraqi month names", () => {
    expect(formatDate(lateEvening, "ar", "long")).toBe("4 تشرين الأول 2026");
    expect(formatDate(lateEvening, "en", "long")).toBe("4 October 2026");
    expect(formatDateTime(lateEvening, "en")).toContain("00:30");
  });

  test("formats IQD without fractional digits", () => {
    // Intl separates the currency code with a no-break space.
    expect(formatCurrency(25_000, "en")).toBe("IQD\u00a025,000");
    expect(formatCurrency(25_000, "ar")).toContain("25,000");
  });

  test("formats relative times", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    expect(formatRelativeTime("2026-10-01T12:00:00Z", "en", now)).toBe(
      "2 days ago"
    );
    expect(formatRelativeTime("2026-10-03T14:00:00Z", "en", now)).toBe(
      "in 2 hours"
    );
    expect(formatRelativeTime(now, "en", now)).toBe("now");
  });

  test("computes the start of day in Baghdad", () => {
    const start = startOfDay(inProjectTimeZone(lateEvening));
    expect(new Date(start.getTime()).toISOString()).toBe(
      "2026-10-03T21:00:00.000Z"
    );
  });

  test("weeks start on Saturday", () => {
    expect(WEEK_STARTS_ON).toBe(6);
  });

  test("knows text direction per locale", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("xx")).toBe("ltr");
  });

  test("labels calendars with Iraqi month names and Latin digits", () => {
    const october = new Date(2026, 9, 15);
    expect(formatMonthYear(october, "ar")).toBe("تشرين الأول 2026");
    expect(formatMonthYear(october, "en")).toBe("October 2026");
    expect(formatCalendarDate(october, "ar")).toBe("15 تشرين الأول 2026");
    // 15 October 2026 is a Thursday.
    expect(formatWeekday(october, "en")).toBe("Thu");
  });
});
