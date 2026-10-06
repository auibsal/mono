// Publishes the public founding documents (docs-source/*.pdf) as
// public/documents/<slug>.pdf, named by the registry. Runs before dev and
// build; the copies are not committed.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const registry = JSON.parse(
  readFileSync(join(root, "packages", "sal-data", "documents.json"), "utf8")
);
const out = join(import.meta.dirname, "..", "public", "documents");
mkdirSync(out, { recursive: true });
for (const doc of registry) {
  copyFileSync(
    join(root, "docs-source", doc.source),
    join(out, `${doc.slug}.pdf`)
  );
}
console.log(`Published ${registry.length} documents to public/documents.`);
