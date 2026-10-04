import { expect, test } from "vitest";
import { sanitizeRichText, toPlainText } from "./sanitize";

test("strips scripts, handlers and unsafe links", () => {
  const html = sanitizeRichText(
    '<p onclick="x()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">x</a> <a href="https://auibsal.org">ok</a></p><iframe src="https://evil"></iframe>'
  );
  expect(html).not.toMatch(/script|onclick|javascript|iframe/);
  expect(html).toContain('<a href="https://auibsal.org" rel="noopener noreferrer nofollow">ok</a>');
});

test("keeps direction attributes for bilingual text", () => {
  expect(sanitizeRichText('<p dir="rtl" lang="ar">ورق</p>')).toBe('<p dir="rtl" lang="ar">ورق</p>');
});

test("plain text for excerpts", () => {
  expect(toPlainText("<p>The paper</p>\n<p>and the pen</p>")).toBe("The paper and the pen");
});
