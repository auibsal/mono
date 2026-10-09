import { describe, expect, test } from "vitest";
import {
  academicYearStart,
  certificateSchema,
  linkedInUrl,
  serviceEntrySchema,
  verificationUrl,
} from "./recognition";

const member = "00000000-0000-4000-8000-000000000001";

describe("recognition", () => {
  test("the academic year starts on September 1", () => {
    expect(academicYearStart(new Date("2026-10-09T00:00:00Z"))).toBe(
      "2026-09-01"
    );
    expect(academicYearStart(new Date("2027-03-01T00:00:00Z"))).toBe(
      "2026-09-01"
    );
    expect(academicYearStart(new Date("2026-08-31T00:00:00Z"))).toBe(
      "2025-09-01"
    );
  });

  test("hours are logged in quarter hours, at most a day", () => {
    const base = { activity: "Side Quest", occurred_on: "2026-10-01" };
    expect(serviceEntrySchema.safeParse({ ...base, hours: 2.5 }).success).toBe(
      true
    );
    expect(serviceEntrySchema.safeParse({ ...base, hours: 2.1 }).success).toBe(
      false
    );
    expect(serviceEntrySchema.safeParse({ ...base, hours: 25 }).success).toBe(
      false
    );
  });

  test("each kind of certificate needs what the Bylaws need", () => {
    expect(
      certificateSchema.safeParse({
        kind: "service",
        period_from: "2026-01-01",
        role_en: "Door Coordinator",
        user_id: member,
      }).success
    ).toBe(true);
    expect(
      certificateSchema.safeParse({ kind: "service", user_id: member }).success
    ).toBe(false);
    expect(
      certificateSchema.safeParse({
        citation_en: "Forty hours of care",
        kind: "fellowship",
        user_id: member,
      }).success
    ).toBe(false);
    expect(
      certificateSchema.safeParse({ kind: "volunteer", user_id: member })
        .success
    ).toBe(false);
  });

  test("verification and LinkedIn links carry the serial and the code", () => {
    const url = verificationUrl("https://auibsal.org/", "en", "abc123");
    expect(url).toBe("https://auibsal.org/en/verify/abc123");
    const linkedIn = new URL(
      linkedInUrl({
        issuedAt: "2026-10-09T10:00:00Z",
        name: "Certificate of Service",
        serial: "SAL-2026-001",
        url,
      })
    );
    expect(linkedIn.searchParams.get("certId")).toBe("SAL-2026-001");
    expect(linkedIn.searchParams.get("certUrl")).toBe(url);
    expect(linkedIn.searchParams.get("issueMonth")).toBe("10");
  });
});
