import "server-only";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { PDFDict, PDFDocument, PDFName, PDFRef } from "pdf-lib";
import sharp from "sharp";

/**
 * Readers' copies of Journal submissions carry no author metadata. What a
 * writer typed into the work itself (a name in the header) is the intake
 * check's job; this removes what the file carries without anyone seeing it.
 *
 * • PDF: pages are copied into a new document, which leaves behind the
 *   document info, XMP and anything unreachable from the pages (including
 *   older revisions); page-level XMP and annotation authors are removed.
 * • JPEG/PNG: re-encoded, which drops EXIF, XMP, IPTC and text chunks.
 * • DOCX: document properties are emptied and tracked-change and comment
 *   authors replaced.
 */
export class BlindCopyError extends Error {}

export const blindExtensions = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

export type BlindMimeType = keyof typeof blindExtensions;

export const isBlindMimeType = (type: string): type is BlindMimeType =>
  type in blindExtensions;

const METADATA = PDFName.of("Metadata");
const PIECE_INFO = PDFName.of("PieceInfo");
const ANNOT_AUTHOR = PDFName.of("T");

export const stripPdf = async (bytes: Uint8Array) => {
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    throw new BlindCopyError("Unreadable or encrypted PDF", { cause: error });
  }
  const copy = await PDFDocument.create({ updateMetadata: false });
  const pages = await copy.copyPages(source, source.getPageIndices());
  for (const page of pages) {
    page.node.delete(METADATA);
    page.node.delete(PIECE_INFO);
    for (const item of page.node.Annots()?.asArray() ?? []) {
      const annot =
        item instanceof PDFRef ? copy.context.lookup(item, PDFDict) : item;
      if (annot instanceof PDFDict) {
        annot.delete(ANNOT_AUTHOR);
      }
    }
    copy.addPage(page);
  }
  return copy.save();
};

export const stripImage = async (bytes: Uint8Array, type: BlindMimeType) => {
  // rotate() applies the EXIF orientation before the metadata is dropped.
  const image = sharp(bytes, { failOn: "error" }).rotate();
  const out =
    type === "image/png"
      ? image.png()
      : image.jpeg({ mozjpeg: true, quality: 92 });
  try {
    return new Uint8Array(await out.toBuffer());
  } catch (error) {
    throw new BlindCopyError("Unreadable image", { cause: error });
  }
};

const EMPTY_PARTS: Record<string, string> = {
  "docProps/app.xml":
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>',
  "docProps/core.xml":
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>',
  "docProps/custom.xml":
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>',
  "word/people.xml":
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w15:people xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"/>',
};

const AUTHOR_ATTRIBUTE = /\b(w:author|w15:author)="[^"]*"/g;
const INITIALS_ATTRIBUTE = /\bw:initials="[^"]*"/g;
const WORD_XML = /^word\/.+\.xml$/;

export const stripDocx = (bytes: Uint8Array) => {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (error) {
    throw new BlindCopyError("Unreadable document", { cause: error });
  }
  if (!files["word/document.xml"]) {
    throw new BlindCopyError("Not a Word document");
  }
  for (const name of Object.keys(files)) {
    const empty = EMPTY_PARTS[name];
    if (empty) {
      files[name] = strToU8(empty);
    } else if (WORD_XML.test(name)) {
      files[name] = strToU8(
        strFromU8(files[name] as Uint8Array)
          .replace(AUTHOR_ATTRIBUTE, '$1="Author"')
          .replace(INITIALS_ATTRIBUTE, 'w:initials=""')
      );
    }
  }
  return zipSync(files, { level: 6 });
};

export const stripMetadata = (bytes: Uint8Array, type: BlindMimeType) => {
  if (type === "application/pdf") {
    return stripPdf(bytes);
  }
  if (type === "image/jpeg" || type === "image/png") {
    return stripImage(bytes, type);
  }
  return Promise.resolve(stripDocx(bytes));
};
