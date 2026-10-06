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

  test("nothing is marked adopted before Charter Day ratification", () => {
    // Every source cover reads "Draft 1 · for ratification" (Oct 2026).
    for (const doc of documents) {
      expect(doc.status, doc.code).toBe("draft");
    }
  });

  test("lookups", () => {
    expect(documentBySlug("constitution")?.code).toBe("SAL-GOV-01");
    expect(documentBySlug("nope")).toBeNull();
    expect(documentPdfPath({ slug: "bylaws" })).toBe("/documents/bylaws.pdf");
  });
});
