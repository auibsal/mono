import { expect, test } from "@playwright/test";
import { event, member } from "../fixtures";
import { urls } from "../playwright.config";
import { expectAccessible, signInWithPassword } from "./helpers";

test("a member books a place and gives it back", async ({ page }) => {
  await signInWithPassword(page, member.email);
  await page.goto(`${urls.app}/en/events`);
  const card = page.locator(`li#${event.slug}`);
  await expect(card).toBeVisible();
  await expectAccessible(page);
  if (
    await card.getByRole("button", { name: "Give my place back" }).isVisible()
  ) {
    await card.getByRole("button", { name: "Give my place back" }).click();
    await expect(card.getByRole("status")).toBeVisible();
  }
  await card.getByRole("button", { name: "Book a place" }).click();
  await expect(card.getByRole("status")).toContainText("Booked");
  await expect(card.getByText("You have a place.")).toBeVisible();
  await card.getByRole("button", { name: "Give my place back" }).click();
  await expect(card.getByRole("status")).toContainText("Done");
});

test("a member sends work to the Journal and sees the reading timeline", async ({
  page,
}) => {
  await signInWithPassword(page, member.email);
  await page.goto(`${urls.app}/en/journal/submit`);
  await page.getByLabel("Title").fill(`A small poem ${Date.now()}`);
  await page.locator('[contenteditable="true"]').first().click();
  await page.keyboard.type("The paper and the pen, and the hour between them.");
  await page.getByLabel(/human authorship|my own/i).check();
  await page.getByRole("button", { name: "Send my work" }).click();
  await expect(page).toHaveURL(/\/en\/journal\/submission/);
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText("Received");
  await expectAccessible(page);
});
