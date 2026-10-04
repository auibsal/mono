import { existsSync } from "node:fs";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { listTextFiles } from "./files";
import { stripModuleBlocks } from "./markers";
import { type TemplateModule, templateModules } from "./modules";
import { type Answers, replaceTokens, tokenValues } from "./tokens";

export interface InitOptions {
  answers: Answers;
  commerce: "digital" | "physical";
  defaultLocale: "ar" | "en";
  /** Module ids to remove. */
  removeModules: string[];
  root: string;
}

export interface InitResult {
  changedFiles: string[];
  createdEnvFiles: string[];
  removedPaths: string[];
}

/** Files that only exist to create projects from the template. */
export const templateOnlyPaths = [
  "scripts/init.ts",
  "scripts/template",
  ".github/workflows/template.yml",
];

/** Root scripts that only make sense in the template. */
const templateOnlyScripts = new Set(["init", "test:template"]);

const ENV_FILE = /(^|\/)\.env(\.[a-z]+)*$/;
const BLANK_LINE_RUNS = /\n{3,}/g;
const WORKSPACE_MANIFEST = /^(apps|packages)\/[^/]+\/package\.json$/;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

type Manifest = Record<string, unknown> & {
  [field in (typeof DEPENDENCY_FIELDS)[number]]?: Record<string, string>;
};

const readJson = async <T = Manifest>(path: string) =>
  JSON.parse(await readFile(path, "utf8")) as T;

const writeJson = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

/** `@repo/*` names of the workspace packages owned by the removed modules. */
const getPackageNames = async (root: string, modules: TemplateModule[]) => {
  const manifests = modules
    .flatMap((module) => module.packages)
    .map((directory) => join(root, directory, "package.json"))
    .filter((path) => existsSync(path));
  const names = await Promise.all(
    manifests.map(async (path) => (await readJson(path)).name as string)
  );

  return new Set(names);
};

const deletePaths = async (root: string, paths: string[]) => {
  const existing = paths.filter((path) => existsSync(join(root, path)));

  await Promise.all(
    existing.map((path) =>
      rm(join(root, path), { force: true, recursive: true })
    )
  );

  return existing;
};

/** Strips module markers and fills in tokens; returns the files it changed. */
const rewriteTextFiles = async (
  root: string,
  files: string[],
  remove: ReadonlySet<string>,
  answers: Answers
) => {
  const values = tokenValues(answers);
  const changed: string[] = [];

  for (const file of files) {
    const path = join(root, file);
    // biome-ignore lint/performance/noAwaitInLoops: sequential IO keeps memory flat
    const original = await readFile(path, "utf8");
    let content = replaceTokens(
      stripModuleBlocks(original, remove, file).content,
      values
    );

    if (ENV_FILE.test(file) || file.endsWith(".env.example")) {
      // Removing blocks can leave runs of blank lines in env files.
      content = content.replace(BLANK_LINE_RUNS, "\n\n");
    }

    if (content !== original) {
      await writeFile(path, content);
      changed.push(file);
    }
  }

  return changed;
};

const removeDependencies = (manifest: Manifest, names: ReadonlySet<string>) => {
  let changed = false;

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = manifest[field];
    if (dependencies) {
      const kept = Object.fromEntries(
        Object.entries(dependencies).filter(([name]) => !names.has(name))
      );
      changed ||= Object.keys(kept).length !== Object.keys(dependencies).length;
      manifest[field] = kept;
    }
  }

  return changed;
};

/** Removes dependencies on deleted packages and module-only libraries. */
const pruneDependencies = async (
  root: string,
  files: string[],
  modules: TemplateModule[],
  packageNames: ReadonlySet<string>
) => {
  const manifests = files.filter(
    (file) =>
      (file === "package.json" || WORKSPACE_MANIFEST.test(file)) &&
      existsSync(join(root, file))
  );
  const changed: string[] = [];

  for (const file of manifests) {
    const extra = modules.flatMap(
      (module) => module.dependencies?.[file] ?? []
    );
    const path = join(root, file);
    // biome-ignore lint/performance/noAwaitInLoops: a handful of small files
    const manifest = await readJson(path);

    if (removeDependencies(manifest, new Set([...packageNames, ...extra]))) {
      await writeJson(path, manifest);
      changed.push(file);
    }
  }

  return changed;
};

const applyProjectSettings = async (
  root: string,
  { answers, commerce, defaultLocale }: InitOptions
) => {
  const projectPath = join(root, "packages/config/project.json");
  const project = await readJson<{
    commerce: { allowNativeCheckout: boolean };
    locale: { default: string; enabled: string[] };
  }>(projectPath);

  project.locale.default = defaultLocale;
  if (!project.locale.enabled.includes(defaultLocale)) {
    project.locale.enabled.unshift(defaultLocale);
  }
  project.commerce.allowNativeCheckout = commerce === "physical";
  await writeJson(projectPath, project);

  const manifestPath = join(root, "package.json");
  const manifest = await readJson<{ name: string; scripts: object }>(
    manifestPath
  );
  manifest.name = answers.projectSlug;
  manifest.scripts = Object.fromEntries(
    Object.entries(manifest.scripts).filter(
      ([name]) => !templateOnlyScripts.has(name)
    )
  );
  await writeJson(manifestPath, manifest);

  return ["packages/config/project.json", "package.json"];
};

/** Creates `.env.local` next to every `.env.example`, never overwriting. */
const createEnvFiles = async (root: string, files: string[]) => {
  const targets = files
    .filter((file) => file.endsWith(".env.example"))
    .map((example) => ({
      example,
      target: join(dirname(example), ".env.local"),
    }))
    .filter(
      ({ example, target }) =>
        existsSync(join(root, example)) && !existsSync(join(root, target))
    );

  await Promise.all(
    targets.map(({ example, target }) =>
      copyFile(join(root, example), join(root, target))
    )
  );

  return targets.map(({ target }) => target);
};

export const applyInit = async (options: InitOptions): Promise<InitResult> => {
  const { answers, removeModules, root } = options;
  const remove = new Set(removeModules);
  const modules = templateModules.filter((module) => remove.has(module.id));

  const packageNames = await getPackageNames(root, modules);
  const removedPaths = await deletePaths(root, [
    ...modules.flatMap((module) => [...module.packages, ...module.paths]),
    ...templateOnlyPaths,
  ]);

  const files = await listTextFiles(root);
  const changed = new Set([
    ...(await rewriteTextFiles(root, files, remove, answers)),
    ...(await pruneDependencies(root, files, modules, packageNames)),
    ...(await applyProjectSettings(root, options)),
  ]);
  const createdEnvFiles = await createEnvFiles(root, files);

  return {
    changedFiles: [...changed].sort(),
    createdEnvFiles,
    removedPaths,
  };
};
