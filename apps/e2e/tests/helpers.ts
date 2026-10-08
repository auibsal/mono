import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { MAILPIT_URL, PASSWORD } from "../fixtures";
import { urls } from "../playwright.config";

/** No serious or critical WCAG 2.1 A/AA violations on the page as shown. */
export const expectAccessible = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(
    serious.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
    )
  ).toEqual([]);
};

export const signInWithPassword = async (page: Page, email: string) => {
  await page.goto(`${urls.app}/en/sign-in`);
  await page.getByLabel("Email").fill(email);
  // AUIB addresses default to a sign-in link; these tests use the password.
  await page.getByRole("button", { name: "Use my password instead" }).click();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${urls.app}/en/?$`));
};

/** The newest email to an address, from the local stack's Mailpit. */
export const latestMail = async (to: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const list = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`
    );
    const body = (await list.json()) as { messages?: { ID: string }[] };
    const id = body.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
      return (await message.json()) as { HTML: string; Text: string };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No email for ${to}`);
};
