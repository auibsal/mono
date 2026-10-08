import { expect, test } from "@playwright/test";
import { event } from "../fixtures";
import { urls } from "../playwright.config";
import { expectAccessible } from "./helpers";

test.describe("public site", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`home renders in ${locale} and is accessible`, async ({ page }) => {
      await page.goto(`${urls.web}/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        locale === "ar" ? "rtl" : "ltr"
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expectAccessible(page);
    });
  }

  test("an event page links booking to the Nexus and carries structured data", async ({
    page,
  }) => {
    await page.goto(`${urls.web}/en/events/${event.slug}`);
    await expect(
      page.getByRole("heading", { name: event.title })
    ).toBeVisible();
    const book = page.getByRole("link", { name: /rsvp|book/i }).first();
    await expect(book).toHaveAttribute(
      "href",
      new RegExp(`/en/events#${event.slug}$`)
    );
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(ld.some((json) => json.includes('"@type":"Event"'))).toBe(true);
    await expectAccessible(page);
  });

  test("the Journal page is accessible", async ({ page }) => {
    await page.goto(`${urls.web}/en/journal`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "AUIB Literary Journal"
    );
    await expectAccessible(page);
  });
});
