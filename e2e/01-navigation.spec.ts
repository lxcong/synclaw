import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("Navigation & Layout", () => {
  test("root redirects to first workspace", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/workspace\//, { timeout: 10000 });
    expect(page.url()).toMatch(/\/workspace\/.+/);
  });

  test("sidebar shows all workspaces", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("公司客服")).toBeVisible();
    await expect(sidebar.getByText("个人生活")).toBeVisible();
    await expect(sidebar.getByText("财务自动化")).toBeVisible();
  });

  test("sidebar shows SyncClaw branding", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await expect(page.locator("aside").getByText("Sync")).toBeVisible();
    await expect(page.locator("aside").getByText("Claw")).toBeVisible();
  });

  test("clicking workspace navigates to it", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.locator("aside").getByText("个人生活").click();
    await page.waitForURL(/\/workspace\//);

    // Top bar should show the workspace name
    const header = page.locator("header");
    await expect(header.getByText("个人生活")).toBeVisible();
  });

  test("Agent Hub link navigates to /agents", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.locator("aside").getByText("Agent 中心").click();
    await page.waitForURL("/agents");
    await expect(page.getByText("Agent 中心").first()).toBeVisible();
  });

  test("Agent Hub button in top bar works", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.locator("header").getByText("Agent Hub").click();
    await page.waitForURL("/agents");
  });
});
