import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { documentBySlug, documentPdfPath, documents } from "./documents";

const sourceDir = join(import.meta.dirname, "..", "..", "docs-source");

describe("document registry", () => {
  test("every public document has exactly one entry, and every entry a file", () => {
    const files = readdirSync(sourceDir)
      .filter((f) => f.endsWith(".pdf"))
      .sort();
    expect(documents.map((d) => d.source).sort()).toEqual(files);
  });

  test("codes and slugs are unique", () => {
    expect(new Set(documents.map((d) => d.code)).size).toBe(documents.length);
    expect(new Set(documents.map((d) => d.slug)).size).toBe(documents.length);
  });

  test("a document whose cover says Draft is never marked adopted", () => {
    // The governing documents read "Draft 1 · for ratification" until the
    // Founding General Assembly ratifies them; the registry follows the cover.
    for (const doc of documents.filter((d) => d.version?.startsWith("Draft"))) {
      expect(doc.status, doc.code).toBe("draft");
    }
  });

  test("the Member Handbook is in force", () => {
    expect(documentBySlug("member-handbook")?.status).toBe("adopted");
  });

  test("lookups", () => {
    expect(documentBySlug("constitution")?.code).toBe("SAL-GOV-01");
    expect(documentBySlug("nope")).toBeNull();
    expect(documentPdfPath({ slug: "bylaws" })).toBe("/documents/bylaws.pdf");
  });
});
