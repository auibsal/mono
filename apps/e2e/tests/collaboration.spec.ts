import { expect, test } from "@playwright/test";
import { editor } from "../fixtures";
import { urls } from "../playwright.config";
import { signInWithPassword } from "./helpers";

/**
 * Two editors on one news post (Supabase Realtime). Needs Realtime with
 * private channels on the stack under test; set E2E_COLLAB=1 to run it (for
 * example against a preview).
 */
test.skip(!process.env.E2E_COLLAB, "Co-editing is not checked here");

test("two editors see each other and each other's typing", async ({
  browser,
}) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  await signInWithPassword(first, editor.email);
  await signInWithPassword(second, editor.email);

  await first.goto(`${urls.app}/en/admin/content`);
  await first
    .getByRole("button", { name: "New post" })
    .or(first.getByRole("link", { name: "New post" }))
    .first()
    .click();
  const title = `Shared draft ${Date.now()}`;
  await first.getByRole("textbox", { name: "English" }).first().fill(title);
  await first
    .getByRole("textbox", { name: "Arabic" })
    .first()
    .fill("مسودة مشتركة");
  await first
    .getByRole("textbox", { name: "Web address (slug)" })
    .fill(`shared-${Date.now()}`);
  await first.getByRole("button", { name: "Save" }).click();
  const url = first.url();

  await second.goto(url);
  await expect(first.getByText(/Also here:/)).toBeVisible({ timeout: 20_000 });
  await first.getByRole("textbox", { name: "Text in English" }).click();
  await first.keyboard.type("Typed in the first window.");
  await expect(
    second.getByRole("textbox", { name: "Text in English" })
  ).toContainText("Typed in the first window.", { timeout: 20_000 });
});
