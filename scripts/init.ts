#!/usr/bin/env bun
/**
 * Turns the template into a new project: fills in every placeholder token,
 * applies regional and commerce settings, removes unwanted optional modules
 * and creates local env files.
 *
 *   bun run init                              # interactive
 *   bun run init --yes --org-name "Acme" ...  # non-interactive (CI)
 */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { applyInit } from "./template/apply";
import { moduleIds, templateModules } from "./template/modules";
import {
  type Answers,
  deriveBundleId,
  slugify,
  validate,
} from "./template/tokens";

const SSH_REMOTE = /^git@([^:]+):/;
const GIT_SUFFIX = /\.git$/;
const WWW_PREFIX = /^www\./;

const HELP = `Usage: bun run init [options]

  --org-name <name>         Organization display name (any script, e.g. Arabic)
  --org-slug <slug>         Organization slug (lowercase-hyphenated)
  --project-name <name>     Project display name
  --project-slug <slug>     Project slug, also the root package name
  --project-url <url>       Public website URL
  --support-email <email>   Support / security contact
  --repo-url <url>          Git repository URL
  --bundle-id <id>          iOS/Android app ID, e.g. iq.example.app
  --default-locale <ar|en>  Default language (default: ar)
  --commerce <digital|physical>
                            digital: SaaS/subscriptions, checkout is web-only
                            physical: goods/services/bookings, checkout is
                            allowed inside the native apps
  --keep-modules <ids>      Comma-separated optional modules to keep, or "all"
                            (${moduleIds.join(", ")})
  --yes                     Non-interactive; accept defaults for the rest
  --skip-install            Don't run bun install and code tidying
  --root <dir>              Directory to initialize (default: current)`;

const { values: flags } = parseArgs({
  options: {
    "bundle-id": { type: "string" },
    commerce: { type: "string" },
    "default-locale": { type: "string" },
    help: { short: "h", type: "boolean" },
    "keep-modules": { type: "string" },
    "org-name": { type: "string" },
    "org-slug": { type: "string" },
    "project-name": { type: "string" },
    "project-slug": { type: "string" },
    "project-url": { type: "string" },
    "repo-url": { type: "string" },
    root: { type: "string" },
    "skip-install": { type: "boolean" },
    "support-email": { type: "string" },
    yes: { short: "y", type: "boolean" },
  },
});

const root = resolve(flags.root ?? process.cwd());
const interactive = !flags.yes;

const fail = (message: string): never => {
  log.error(message);
  process.exit(1);
};

const exitIfCancelled = <T>(value: T | symbol): Exclude<T, symbol> => {
  if (isCancel(value)) {
    cancel("Initialization cancelled. Nothing was changed.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
};

interface Question {
  defaultValue?: string;
  message: string;
  placeholder?: string;
  validate: (value: string) => string | undefined;
}

/** A flag wins; otherwise prompt (interactive) or fall back to the default. */
const ask = async (flag: string | undefined, question: Question) => {
  const value =
    flag ??
    (interactive
      ? exitIfCancelled(
          await text({
            defaultValue: question.defaultValue,
            message: question.message,
            placeholder: question.placeholder ?? question.defaultValue,
            validate: (input) =>
              question.validate(input || question.defaultValue || ""),
          })
        )
      : question.defaultValue);

  if (value === undefined || value === "") {
    return fail(`${question.message} is required (pass it as a flag).`);
  }

  const error = question.validate(value);
  return error ? fail(`${question.message}: ${error}`) : value;
};

const choose = async <T extends string>(
  flag: string | undefined,
  allowed: readonly T[],
  prompt: Parameters<typeof select<T>>[0]
): Promise<T> => {
  const value =
    flag ??
    (interactive
      ? exitIfCancelled(await select<T>(prompt))
      : prompt.initialValue);

  if (!(value && allowed.includes(value as T))) {
    return fail(`${prompt.message}: use one of ${allowed.join(", ")}.`);
  }
  return value as T;
};

const detectRepoUrl = () => {
  const remote = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
  });

  // No git repository or no origin remote.
  if (remote.status !== 0) {
    return;
  }

  return remote.stdout
    .trim()
    .replace(SSH_REMOTE, "https://$1/")
    .replace(GIT_SUFFIX, "");
};

const ensureUninitialized = async () => {
  const project = JSON.parse(
    await readFile(join(root, "packages/config/project.json"), "utf8")
  ) as { name: string };

  if (!project.name.startsWith("{{")) {
    fail(
      `This repository is already initialized as "${project.name}". Run init on a fresh copy of the template.`
    );
  }
};

const collectIdentity = async (): Promise<Answers> => {
  const orgName = await ask(flags["org-name"], {
    message: "Organization name",
    placeholder: "964 Reserve",
    validate: validate.required,
  });
  const orgSlug = await ask(flags["org-slug"], {
    defaultValue: slugify(orgName) || undefined,
    message: "Organization slug",
    validate: validate.slug,
  });
  const projectName = await ask(flags["project-name"], {
    message: "Project name",
    placeholder: "Reserve",
    validate: validate.required,
  });
  const projectSlug = await ask(flags["project-slug"], {
    defaultValue: slugify(projectName) || undefined,
    message: "Project slug (root package name)",
    validate: validate.slug,
  });
  const projectUrl = await ask(flags["project-url"], {
    defaultValue: `https://${projectSlug}.iq`,
    message: "Public website URL",
    validate: validate.url,
  });
  const supportEmail = await ask(flags["support-email"], {
    defaultValue: `support@${new URL(projectUrl).hostname.replace(WWW_PREFIX, "")}`,
    message: "Support email",
    validate: validate.email,
  });
  const repoUrl = await ask(flags["repo-url"], {
    defaultValue:
      detectRepoUrl() ?? `https://github.com/${orgSlug}/${projectSlug}`,
    message: "Repository URL",
    validate: validate.url,
  });
  const bundleId = await ask(flags["bundle-id"], {
    defaultValue: deriveBundleId(projectUrl, projectSlug),
    message: "iOS/Android app ID",
    validate: validate.bundleId,
  });

  return {
    bundleId,
    orgName,
    orgSlug,
    projectName,
    projectSlug,
    projectUrl,
    repoUrl,
    supportEmail,
    year: new Date().getFullYear(),
  };
};

const collectModulesToRemove = async () => {
  const keepFlag = flags["keep-modules"];
  let keep: string[];

  if (keepFlag === "all") {
    keep = moduleIds;
  } else if (keepFlag !== undefined) {
    keep = keepFlag
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  } else if (interactive) {
    keep = exitIfCancelled(
      await multiselect({
        initialValues: moduleIds,
        message: "Optional modules to keep (space to toggle)",
        options: templateModules.map((module) => ({
          hint: module.description,
          label: module.name,
          value: module.id,
        })),
        required: false,
      })
    );
  } else {
    keep = moduleIds;
  }

  const unknown = keep.filter((id) => !moduleIds.includes(id));
  if (unknown.length > 0) {
    fail(`Unknown module(s): ${unknown.join(", ")}`);
  }

  return moduleIds.filter((id) => !keep.includes(id));
};

/** Installs dependencies and removes code left unused by removed modules. */
const installAndTidy = () => {
  const progress = spinner();
  progress.start("Installing dependencies");
  const install = spawnSync("bun", ["install"], { cwd: root, stdio: "pipe" });
  if (install.status !== 0) {
    progress.stop("bun install failed");
    fail(install.stderr.toString());
  }
  progress.stop("Dependencies installed");

  progress.start("Tidying code");
  const biome = join(root, "node_modules/.bin/biome");
  // Format first so emptied JSX elements and blocks are recognized as empty.
  spawnSync(biome, ["format", "--write", "."], { cwd: root, stdio: "ignore" });
  spawnSync(
    biome,
    [
      "lint",
      "--write",
      "--unsafe",
      // Fixes that removing module code can make necessary.
      "--only=lint/correctness/noUnusedImports",
      "--only=lint/correctness/noUnusedVariables",
      "--only=lint/style/useSelfClosingElements",
      "--only=lint/style/useConst",
      ".",
    ],
    { cwd: root, stdio: "ignore" }
  );
  spawnSync(biome, ["check", "--write", "."], { cwd: root, stdio: "ignore" });
  progress.stop("Code tidied");
};

const run = async () => {
  intro("Create a new project from the template");
  await ensureUninitialized();

  const answers = await collectIdentity();
  const defaultLocale = await choose<"ar" | "en">(
    flags["default-locale"],
    ["ar", "en"],
    {
      initialValue: "ar",
      message: "Default language",
      options: [
        { label: "العربية (Arabic, RTL)", value: "ar" },
        { label: "English (LTR)", value: "en" },
      ],
    }
  );
  const commerce = await choose<"digital" | "physical">(
    flags.commerce,
    ["digital", "physical"],
    {
      initialValue: "digital",
      message: "What does this project sell?",
      options: [
        {
          hint: "checkout stays on the web; app stores require their own billing",
          label: "Digital products or subscriptions (SaaS)",
          value: "digital",
        },
        {
          hint: "Wayl checkout is allowed inside the native apps",
          label: "Physical goods or real-world services (retail, bookings)",
          value: "physical",
        },
      ],
    }
  );
  const removeModules = await collectModulesToRemove();

  note(
    [
      `Organization   ${answers.orgName} (${answers.orgSlug})`,
      `Project        ${answers.projectName} (${answers.projectSlug})`,
      `Website        ${answers.projectUrl}`,
      `Support        ${answers.supportEmail}`,
      `Repository     ${answers.repoUrl}`,
      `App ID         ${answers.bundleId}`,
      `Language       ${defaultLocale}`,
      `Commerce       ${commerce}`,
      `Remove         ${removeModules.join(", ") || "nothing"}`,
    ].join("\n"),
    "Summary"
  );

  if (
    interactive &&
    !exitIfCancelled(await confirm({ message: "Apply these settings?" }))
  ) {
    cancel("Initialization cancelled. Nothing was changed.");
    process.exit(0);
  }

  const progress = spinner();
  progress.start("Applying template settings");
  const result = await applyInit({
    answers,
    commerce,
    defaultLocale,
    removeModules,
    root,
  });
  progress.stop(
    `Updated ${result.changedFiles.length} files, removed ${result.removedPaths.length} paths`
  );

  if (!flags["skip-install"]) {
    installAndTidy();
  }

  const check = spawnSync("bun", ["scripts/check-placeholders.ts"], {
    cwd: root,
    stdio: "inherit",
  });
  if (check.status !== 0) {
    fail("Some placeholders were not filled in (see above).");
  }

  outro(
    [
      `${answers.projectName} is ready.`,
      "",
      "Next steps:",
      "  1. Fill in the .env.local files (Supabase keys first).",
      "  2. bun run dev",
      "  3. Review and commit the changes.",
    ].join("\n")
  );
};

if (flags.help) {
  console.log(HELP);
} else {
  await run();
}
