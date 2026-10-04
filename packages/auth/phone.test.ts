import { describe, expect, test } from "vitest";
import {
  formatPhone,
  isIraqiMobile,
  normalizePhone,
  toWesternDigits,
} from "./phone";

describe("phone numbers", () => {
  test("converts Arabic-Indic and Persian digits", () => {
    expect(toWesternDigits("٠٧٧٠١٢٣٤٥٦٧")).toBe("07701234567");
    expect(toWesternDigits("۰۷۵۰")).toBe("0750");
  });

  test.each([
    ["0770 123 4567"],
    ["07701234567"],
    ["٠٧٧٠١٢٣٤٥٦٧"],
    ["+964 770 123 4567"],
    ["00964 770 123 4567"],
    ["964 770 123 4567"],
  ])("normalizes %s to E.164", (input) => {
    expect(normalizePhone(input)).toBe("+9647701234567");
  });

  test("rejects invalid numbers", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });

  test("accepts other countries when given with a country code", () => {
    expect(normalizePhone("+971 50 123 4567")).toBe("+971501234567");
  });

  test("detects Iraqi mobile numbers", () => {
    expect(isIraqiMobile("+9647701234567")).toBe(true);
    expect(isIraqiMobile("+96417123456")).toBe(false);
    expect(isIraqiMobile("+971501234567")).toBe(false);
  });

  test("formats numbers for display", () => {
    expect(formatPhone("+9647701234567")).toBe("+964 770 123 4567");
    expect(formatPhone("9647701234567", "national")).toBe("0770 123 4567");
  });
});
