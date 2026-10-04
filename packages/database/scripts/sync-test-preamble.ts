#!/usr/bin/env bun
/**
 * Copies supabase/test-helpers/preamble.sql into every pgTAP file between
 * the `-- <preamble>` and `-- </preamble>` markers (pg_prove runs each file
 * on its own, so they can't share an include).
 *
 *   bun scripts/sync-test-preamble.ts          # rewrite
 *   bun scripts/sync-test-preamble.ts --check  # fail if any file is stale
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "supabase");
const testsDir = join(root, "tests", "database");
const START = "-- <preamble>";
const END = "-- </preamble>";

const preamble = (
  await readFile(join(root, "test-helpers", "preamble.sql"), "utf8")
).trim();
const check = process.argv.includes("--check");
const stale: string[] = [];

const files = (await readdir(testsDir)).filter((name) => name.endsWith(".sql"));

for (const file of files) {
  const path = join(testsDir, file);
  // biome-ignore lint/performance/noAwaitInLoops: a handful of files, read in order
  const source = await readFile(path, "utf8");
  const start = source.indexOf(START);
  const end = source.indexOf(END);

  if (start === -1 || end === -1) {
    continue;
  }

  const next = `${source.slice(0, start + START.length)}\n${preamble}\n${source.slice(end)}`;

  if (next !== source) {
    stale.push(file);
    if (!check) {
      await writeFile(path, next);
    }
  }
}

if (check && stale.length > 0) {
  console.error(
    `Stale pgTAP preamble in: ${stale.join(", ")}. Run db:test:sync.`
  );
  process.exit(1);
}
