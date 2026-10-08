import { expect, test } from "@playwright/test";
import { editor } from "../fixtures";
import { urls } from "../playwright.config";
import { expectAccessible, signInWithPassword } from "./helpers";

test("an editor publishes a news post and it appears on the public site", async ({
  page,
}) => {
  const title = `Society notes ${Date.now()}`;
  await signInWithPassword(page, editor.email);
  // No Overview for this role: /admin opens the first section it has.
  await page.goto(`${urls.app}/en/admin`);
  await expect(page).toHaveURL(/\/en\/admin\/members/);
  await expectAccessible(page);

  await page.goto(`${urls.app}/en/admin/content`);
  await page
    .getByRole("link", { name: "New post" })
    .or(page.getByRole("button", { name: "New post" }))
    .first()
    .click();
  await page.getByRole("textbox", { name: "English" }).first().fill(title);
  await page
    .getByRole("textbox", { name: "Arabic" })
    .first()
    .fill("ملاحظات الجمعية");
  await page
    .getByRole("textbox", { name: "Web address (slug)" })
    .fill(`society-notes-${Date.now()}`);
  await page.getByRole("textbox", { name: "Text in English" }).click();
  await page.keyboard.type("A short note from the Society.");
  await page.getByRole("button", { name: "Publish" }).click();
  const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole("button", { name: "Publish" }).click();
  }
  await expect(
    page.getByRole("button", { name: "Back to draft" })
  ).toBeVisible();

  await page.goto(`${urls.web}/en/news`);
  await expect(page.getByText(title)).toBeVisible();
});
