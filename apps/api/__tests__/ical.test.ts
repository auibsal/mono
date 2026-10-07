import { describe, expect, test } from "vitest";
import { parseIcal } from "@/lib/ical";

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:10001-1791000000-1791003600@auib.edu.iq",
  "SUMMARY:Career Fair\\, Fall 2026",
  "DTSTART;TZID=Asia/Baghdad:20261015T100000",
  "DTEND;TZID=Asia/Baghdad:20261015T140000",
  "LOCATION:Main Hall",
  "URL:https://auib.edu.iq/event/career-fair/",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:10002@auib.edu.iq",
  "SUMMARY:Fall break",
  "DTSTART;VALUE=DATE:20261101",
  "DTEND;VALUE=DATE:20261103",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:10003@auib.edu.iq",
  "SUMMARY:A long title that",
  "  wraps onto a folded line",
  "DTSTART:20261020T090000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:No UID, skipped",
  "DTSTART:20261020T090000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("iCal reader", () => {
  const events = parseIcal(FEED);

  test("reads VEVENTs with a UID, a title and a start", () => {
    expect(events.map((e) => e.uid)).toEqual([
      "10001-1791000000-1791003600@auib.edu.iq",
      "10002@auib.edu.iq",
      "10003@auib.edu.iq",
    ]);
  });

  test("times with a TZID are read in that zone", () => {
    expect(events[0]?.start).toBe("2026-10-15T07:00:00.000Z");
    expect(events[0]?.end).toBe("2026-10-15T11:00:00.000Z");
    expect(events[0]?.title).toBe("Career Fair, Fall 2026");
    expect(events[0]?.location).toBe("Main Hall");
  });

  test("dates are all-day; folded lines are joined; UTC stays UTC", () => {
    expect(events[1]?.allDay).toBe(true);
    expect(events[2]?.title).toBe("A long title that wraps onto a folded line");
    expect(events[2]?.start).toBe("2026-10-20T09:00:00.000Z");
  });
});
