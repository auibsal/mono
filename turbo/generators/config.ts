import type { PlopTypes } from "@turbo/gen";

const SCOPE = "@repo/";
const PACKAGE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("package", {
    actions: [
      (answers) => {
        if (
          "name" in answers &&
          typeof answers.name === "string" &&
          answers.name.startsWith(SCOPE)
        ) {
          answers.name = answers.name.slice(SCOPE.length);
        }
        return "Config sanitized";
      },
      {
        path: "packages/{{ name }}/package.json",
        templateFile: "templates/package.json.hbs",
        type: "add",
      },
      {
        path: "packages/{{ name }}/tsconfig.json",
        templateFile: "templates/tsconfig.json.hbs",
        type: "add",
      },
      {
        path: "packages/{{ name }}/index.ts",
        templateFile: "templates/index.ts.hbs",
        type: "add",
      },
    ],
    description:
      "Create a new shared package in packages/ (run `bun install` after)",
    prompts: [
      {
        message: `Package name (without the ${SCOPE} prefix)`,
        name: "name",
        type: "input",
        validate: (value: string) =>
          PACKAGE_NAME.test(value.replace(SCOPE, ""))
            ? true
            : "Use lowercase letters, digits and hyphens.",
      },
    ],
  });
}
