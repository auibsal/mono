import { describe, expect, it } from "vitest";
import {
  checkFile,
  decodeFileName,
  encodeFileName,
  fileNameOf,
  objectPath,
} from "./files";

// Supabase Storage's key rule (storage-api `isValidKey`).
const VALID_KEY = /^(\w|\/|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/;

describe("file names in keys", () => {
  it.each([
    "Invoice March (2).pdf",
    "عقد الإيجار ٢٠٢٦.pdf",
    "کوردی.docx",
    "a/b\\c.txt",
    "100% done!.png",
    "photo 📷.jpg",
    "no-extension",
  ])("round-trips %s through a valid key", (name) => {
    const path = objectPath("6f1c6a8e-0000-4000-8000-000000000000", name);
    expect(path).toMatch(VALID_KEY);
    expect(path.split("/")).toHaveLength(2);
    expect(fileNameOf(path)).toBe(name);
  });

  it("keeps Latin names readable", () => {
    expect(encodeFileName("Invoice March (2).pdf")).toBe(
      "Invoice March (2).pdf"
    );
    expect(encodeFileName("عقد.pdf")).toBe("!D8!B9!D9!82!D8!AF.pdf");
    expect(decodeFileName("!D8!B9!D9!82!D8!AF.pdf")).toBe("عقد.pdf");
  });

  it("shortens very long names but keeps the extension", () => {
    const encoded = encodeFileName(`${"ع".repeat(300)}.pdf`);
    expect(encoded.length).toBeLessThanOrEqual(600);
    expect(encoded.endsWith(".pdf")).toBe(true);
  });

  it("names blank files", () => {
    expect(encodeFileName("   ")).toBe("file");
  });
});

describe("checkFile", () => {
  it("applies the bucket limits", () => {
    expect(checkFile("avatars", { size: 1000, type: "image/png" })).toBeNull();
    expect(checkFile("avatars", { size: 1000, type: "image/gif" })).toBe(
      "type_not_allowed"
    );
    expect(
      checkFile("avatars", { size: 3 * 1024 * 1024, type: "image/png" })
    ).toBe("too_large");
    expect(checkFile("orgFiles", { size: 0, type: "text/plain" })).toBe(
      "empty"
    );
    expect(
      checkFile("orgFiles", { size: 10, type: "application/x-anything" })
    ).toBeNull();
  });
});
