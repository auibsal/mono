import { describe, expect, test } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("CSV exports", () => {
  test("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Farjo, "Shaheen"')).toBe('"Farjo, ""Shaheen"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  test("neutralises spreadsheet formulas", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  test("keeps Arabic and empty cells", () => {
    expect(csvCell("جمعية الفنون والآداب")).toBe("جمعية الفنون والآداب");
    expect(csvCell(null)).toBe("");
  });

  test("starts with a BOM and uses CRLF rows", () => {
    expect(toCsv(["a", "b"], [[1, 2]])).toBe("﻿a,b\r\n1,2\r\n");
  });
});
