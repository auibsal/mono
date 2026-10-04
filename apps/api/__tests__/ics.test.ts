import { expect, test } from "vitest";
import { fold, renderCalendar } from "../lib/ics";

test("renders a valid calendar with CRLF and UTC times", () => {
  const ics = renderCalendar(
    "SAL",
    [
      {
        location: "Library, Room 2",
        start: "2026-10-13T15:00:00Z",
        tag: "[RSVP]",
        title: "Open Pages; poems, prose",
        uid: "e1@auibsal.org",
      },
    ],
    new Date("2026-10-01T00:00:00Z")
  );
  expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(ics).toContain("DTSTART:20261013T150000Z\r\n");
  expect(ics).toContain("DTEND:20261013T170000Z\r\n");
  // RFC 5545 escapes: "\;" and "\," (raw strings keep the backslashes).
  expect(ics).toContain(
    `${String.raw`SUMMARY:[RSVP] Open Pages\; poems\, prose`}\r\n`
  );
  expect(ics).toContain(`${String.raw`LOCATION:Library\, Room 2`}\r\n`);
  expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
});

test("folds long lines at 75 octets without splitting Arabic letters", () => {
  const line = `SUMMARY:${"ورق ".repeat(30)}`;
  const folded = fold(line).split("\r\n");
  for (const part of folded) {
    expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
  }
  expect(folded.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
});
