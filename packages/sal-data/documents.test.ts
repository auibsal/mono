import { describe, expect, test } from "vitest";
import { documentBody, documentSections, documentTitle } from "./documents";

describe("documents", () => {
  test("titles and text fall back to English", () => {
    const doc = {
      body_ar: null,
      body_en: "<p>Text</p>",
      title_ar: null,
      title_en: "The Constitution",
    };
    expect(documentTitle(doc, "ar")).toBe("The Constitution");
    expect(documentTitle({ ...doc, title_ar: "الدستور" }, "ar")).toBe(
      "الدستور"
    );
    expect(documentBody(doc, "ar")).toEqual({
      english: true,
      html: "<p>Text</p>",
    });
    expect(documentBody({ ...doc, body_ar: "<p>نص</p>" }, "ar")).toEqual({
      english: false,
      html: "<p>نص</p>",
    });
  });

  test("sections get ids and a table of contents", () => {
    const { contents, html } = documentSections(
      "<h2>The Articles</h2><p>1.1</p><h2>Roles &amp; Staffing</h2>"
    );
    expect(contents).toEqual([
      { id: "1-the-articles", title: "The Articles" },
      { id: "2-roles-staffing", title: "Roles & Staffing" },
    ]);
    expect(html).toContain('<h2 id="1-the-articles">The Articles</h2>');
  });

  test("document text is sanitized; tables survive", () => {
    const { html } = documentSections(
      '<table><tr><td colspan="2">A</td></tr></table><script>alert(1)</script><p onclick="x">B</p>'
    );
    expect(html).toContain('<td colspan="2">A</td>');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
  });
});
