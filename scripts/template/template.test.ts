import { describe, expect, test } from "vitest";
import { MarkerError, stripModuleBlocks } from "./markers";
import {
  deriveBundleId,
  findTokens,
  replaceTokens,
  slugify,
  tokenValues,
  validate,
} from "./tokens";

const answers = {
  bundleId: "iq.example.reserve",
  orgName: "شركة ٩٦٤",
  orgSlug: "964-reserve",
  projectName: "Reserve",
  projectSlug: "reserve",
  projectUrl: "https://reserve.example.iq",
  repoUrl: "https://github.com/acme/reserve",
  supportEmail: "support@example.iq",
  year: 2026,
};

describe("tokens", () => {
  test("replaces known tokens and leaves others alone", () => {
    // An unknown token, built at runtime so the placeholder check ignores it.
    const other = ["{{", "OTHER", "}}"].join("");
    const input = `{{PROJECT_NAME}} by {{ORG_NAME}} © {{YEAR}} ${other} {{ name }}`;
    expect(replaceTokens(input, tokenValues(answers))).toBe(
      `Reserve by شركة ٩٦٤ © 2026 ${other} {{ name }}`
    );
  });

  test("finds tokens but not Handlebars expressions", () => {
    expect(findTokens('{{ORG_SLUG}} "@repo/{{ name }}"')).toEqual(["ORG_SLUG"]);
  });

  test("slugifies names", () => {
    expect(slugify("964 Reserve — Erbil!")).toBe("964-reserve-erbil");
    expect(slugify("شركة")).toBe("");
  });

  test("derives a valid reverse-DNS bundle id", () => {
    const id = deriveBundleId("https://www.964-reserve.iq", "reserve-app");
    expect(id).toBe("iq.app964reserve.reserveapp");
    expect(validate.bundleId(id)).toBeUndefined();
  });

  test("validates inputs", () => {
    expect(validate.slug("my-app")).toBeUndefined();
    expect(validate.slug("My App")).toBeDefined();
    expect(validate.url("example.iq")).toBeDefined();
    expect(validate.email("a@b.iq")).toBeUndefined();
    expect(validate.bundleId("com.example.my-app")).toBeDefined();
  });
});

describe("module markers", () => {
  const source = [
    "const extensions = [",
    "  core(),",
    "  // <module:cms>",
    "  cms(),",
    "  // </module:cms>",
    "  // <module:flags>",
    "  flags(),",
    "  // </module:flags>",
    "];",
    "{/* <module:cms> */}",
    "<Toolbar />",
    "{/* </module:cms> */}",
    "# <module:cms>",
    'BASEHUB_TOKEN=""',
    "# </module:cms>",
  ].join("\n");

  test("removes blocks of removed modules and markers of kept ones", () => {
    const { content, modules } = stripModuleBlocks(source, new Set(["cms"]));
    expect(content).toBe(
      ["const extensions = [", "  core(),", "  flags(),", "];"].join("\n")
    );
    expect([...modules].sort()).toEqual(["cms", "flags"]);
  });

  test("keeps everything when nothing is removed", () => {
    const { content } = stripModuleBlocks(source, new Set());
    expect(content).toContain("cms(),");
    expect(content).toContain("<Toolbar />");
    expect(content).not.toContain("<module:");
  });

  test("supports nested blocks", () => {
    const nested = [
      "// <module:a>",
      "a",
      "// <module:b>",
      "b",
      "// </module:b>",
      "// </module:a>",
      "c",
    ].join("\n");
    expect(stripModuleBlocks(nested, new Set(["b"])).content).toBe("a\nc");
    expect(stripModuleBlocks(nested, new Set(["a"])).content).toBe("c");
  });

  test("rejects unbalanced markers", () => {
    expect(() =>
      stripModuleBlocks("// <module:a>\nx\n// </module:b>", new Set())
    ).toThrow(MarkerError);
    expect(() => stripModuleBlocks("// <module:a>\nx", new Set())).toThrow(
      MarkerError
    );
  });
});
