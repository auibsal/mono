/**
 * CSV for spreadsheet apps: RFC 4180 quoting, a BOM so Excel reads UTF-8
 * (Arabic names), and formula injection neutralized: a cell that starts
 * with = + - @ (or a tab/CR) is prefixed with an apostrophe.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\n\r]/;

export const csvCell = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }
  let text = typeof value === "string" ? value : String(value);
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const toCsv = (
  header: readonly string[],
  rows: readonly (readonly unknown[])[]
) =>
  `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
