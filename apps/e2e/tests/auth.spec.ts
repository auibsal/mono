import { expect, test } from "@playwright/test";
import { member, PASSWORD } from "../fixtures";
import { urls } from "../playwright.config";
import { expectAccessible, latestMail, signInWithPassword } from "./helpers";

test("sign up with an AUIB address, confirm by email, finish setup", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@auib.edu.iq`;
  await page.goto(`${urls.app}/en/sign-up`);
  await expectAccessible(page);
  await page.getByLabel("Full name (English)").fill("New Member");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();

  const mail = await latestMail(email);
  const link = /href="([^"]*\/auth\/confirm\?[^"]+)"/.exec(mail.HTML)?.[1];
  expect(link).toBeTruthy();
  await page.goto((link ?? "").replaceAll("&amp;", "&"));
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/en\/setup/);
  await expect(page.getByText("1 of 4 done")).toBeVisible();
  await expect(page.getByLabel("Name in English")).toHaveValue("New Member");
  await page.getByLabel("I make the Human Authorship pledge").check();
  await page.getByLabel("I make the Member Pledge").check();
  await expect(page.getByText("4 of 4 done")).toBeVisible();
  await page.getByRole("button", { name: "Enter the Nexus" }).click();
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
});

test("an AUIB address signs in by link by default, or by password", async ({
  page,
}) => {
  await page.goto(`${urls.app}/en/sign-in`);
  await page.getByLabel("Email").fill(member.email);
  await expect(
    page.getByRole("button", { name: "Send the link" })
  ).toBeVisible();
  await signInWithPassword(page, member.email);
  await expectAccessible(page);
});
