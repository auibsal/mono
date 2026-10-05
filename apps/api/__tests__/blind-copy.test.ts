// @vitest-environment node
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { BlindCopyError, stripDocx, stripImage, stripPdf } = await import(
  "@/lib/blind-copy"
);

const AUTHOR = "Layla Hassan";
const text = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("blind copies", () => {
  test("a PDF loses its document info and XMP", async () => {
    const source = await PDFDocument.create();
    source.setAuthor(AUTHOR);
    source.setTitle("The First Rain");
    source.setCreator(AUTHOR);
    source.addPage([200, 200]).drawText("Rain on the roof.", { x: 10, y: 100 });
    const xmp = source.context.stream(
      `<x:xmpmeta><dc:creator>${AUTHOR}</dc:creator></x:xmpmeta>`
    );
    source.catalog.set(PDFName.of("Metadata"), source.context.register(xmp));
    const bytes = await source.save({ useObjectStreams: false });
    expect(text(bytes)).toContain(AUTHOR);

    const blind = await stripPdf(bytes);
    expect(text(blind)).not.toContain(AUTHOR);
    const reopened = await PDFDocument.load(blind, { updateMetadata: false });
    expect(reopened.getPageCount()).toBe(1);
    expect(reopened.getAuthor()).toBeUndefined();
  });

  test("an unreadable PDF is refused, never passed through", async () => {
    await expect(stripPdf(strToU8("not a pdf"))).rejects.toBeInstanceOf(
      BlindCopyError
    );
  });

  test("a JPEG loses its EXIF", async () => {
    const bytes = await sharp({
      create: { background: "#ffffff", channels: 3, height: 8, width: 8 },
    })
      .jpeg()
      .withExif({ IFD0: { Artist: AUTHOR, Copyright: AUTHOR } })
      .toBuffer();
    expect((await sharp(bytes).metadata()).exif).toBeDefined();

    const blind = await stripImage(new Uint8Array(bytes), "image/jpeg");
    const meta = await sharp(blind).metadata();
    expect(meta.exif).toBeUndefined();
    expect(text(blind)).not.toContain(AUTHOR);
  });

  test("a Word document loses its properties and revision authors", () => {
    const docx = zipSync({
      "docProps/core.xml": strToU8(
        `<cp:coreProperties><dc:creator>${AUTHOR}</dc:creator><cp:lastModifiedBy>${AUTHOR}</cp:lastModifiedBy></cp:coreProperties>`
      ),
      "word/comments.xml": strToU8(
        `<w:comments><w:comment w:id="0" w:author="${AUTHOR}" w:initials="LH"/></w:comments>`
      ),
      "word/document.xml": strToU8(
        `<w:document><w:ins w:author="${AUTHOR}"><w:t>Rain</w:t></w:ins></w:document>`
      ),
    });

    const files = unzipSync(stripDocx(docx));
    const all = Object.values(files)
      .map((file) => strFromU8(file))
      .join("\n");
    expect(all).not.toContain(AUTHOR);
    expect(all).not.toContain('w:initials="LH"');
    expect(strFromU8(files["word/document.xml"] as Uint8Array)).toContain(
      "<w:t>Rain</w:t>"
    );
  });

  test("a zip that is not a Word document is refused", () => {
    expect(() => stripDocx(zipSync({ "a.txt": strToU8("x") }))).toThrow(
      BlindCopyError
    );
  });
});
