import { describe, expect, test } from "vitest";
import { parseScan } from "@/components/admin/events/check-in";

describe("check-in scans", () => {
  test("reads a ticket QR", () => {
    expect(parseScan("sal:ticket:0123456789abcdef01234567")).toEqual({
      ticket_code: "0123456789abcdef01234567",
    });
  });

  test("reads a membership card QR", () => {
    expect(
      parseScan("sal:member:0b6f6d5e-1f2a-4c3b-9d8e-7f6a5b4c3d2e")
    ).toEqual({ target_user: "0b6f6d5e-1f2a-4c3b-9d8e-7f6a5b4c3d2e" });
  });

  test("ignores anything else", () => {
    for (const value of [
      "https://example.com",
      "sal:ticket:nothex",
      "sal:ticket:0123456789abcdef0123456789",
      "sal:member:not-a-uuid",
    ]) {
      expect(parseScan(value), value).toBeNull();
    }
  });
});
