#!/usr/bin/env bun
/**
 * Flags user-visible text written directly in the apps' JSX instead of
 * coming from the messages files (packages/internationalization/messages):
 * text between tags and translatable attributes (placeholder, title, alt,
 * aria-label). Both languages must come from translations.
 *
 *   bun run check:i18n
 *
 * Not flagged: lines with an `i18n-ignore` comment, and text without
 * letters (numbers, punctuation, symbols).
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = [
  "apps/app/app",
  "apps/app/components",
  "apps/web/app",
  "apps/web/components",
];
const IGNORED_DIRECTORIES = new Set([".next", "node_modules", "out"]);
// Latin or Arabic-script letters.
const LETTERS = /[A-Za-z؀-ۿ]{2,}/;
// Text between a closing ">" and the next "<" on the same line.
const JSX_TEXT = />([^<>{}]+)</g;
const TEXT_ATTRIBUTE = /\b(?:placeholder|title|alt|aria-label)="([^"]*)"/g;
// "=> value <" and generics like Array<string> are code, not JSX text.
const CODE_LIKE = /[=]>|[;=]|^\s*\w+\s*$/;

interface Finding {
  file: string;
  line: number;
  text: string;
}

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => []
  );
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ? [] : listFiles(path);
      }
      return extname(entry.name) === ".tsx" ? [path] : [];
    })
  );
  return nested.flat();
};

const root = process.cwd();
const files = (
  await Promise.all(ROOTS.map((dir) => listFiles(join(root, dir))))
).flat();
const findings: Finding[] = [];

for (const path of files) {
  // biome-ignore lint/performance/noAwaitInLoops: sequential IO keeps memory flat
  const lines = (await readFile(path, "utf8")).split("\n");

  lines.forEach((text, index) => {
    if (text.includes("i18n-ignore") || text.trimStart().startsWith("//")) {
      return;
    }
    const candidates = [
      ...[...text.matchAll(JSX_TEXT)]
        .map((match) => match[1] ?? "")
        .filter((candidate) => !CODE_LIKE.test(candidate)),
      ...[...text.matchAll(TEXT_ATTRIBUTE)].map((match) => match[1] ?? ""),
    ];
    for (const candidate of candidates) {
      if (LETTERS.test(candidate)) {
        findings.push({
          file: relative(root, path),
          line: index + 1,
          text: candidate.trim(),
        });
      }
    }
  });
}

if (findings.length === 0) {
  console.log(`i18n OK: no hard-coded UI text in ${files.length} files.`);
} else {
  console.error("Hard-coded UI text (move it to the messages files):");
  for (const { file, line, text } of findings) {
    console.error(`  ${file}:${line}  ${text}`);
  }
  process.exit(1);
}
