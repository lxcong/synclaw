import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("Task Inspector", () => {
  test("clicking a task card opens the slide-over panel", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Click on a task card
    await page.getByText("更新客服话术模板").click();
    await page.waitForTimeout(500);

    // Sheet panel should open with task title
    const sheet = page.locator("[role='dialog']");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("更新客服话术模板")).toBeVisible();
  });

  test("inspector shows status badge", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("更新客服话术模板").click();
    await page.waitForTimeout(500);

    // Should show "已完成" badge for done task
    const sheet = page.locator("[role='dialog']");
    await expect(sheet.getByText("已完成")).toBeVisible();
  });

  test("inspector shows task description", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("VVIP 客户退款超期审批").click();
    await page.waitForTimeout(500);

    const sheet = page.locator("[role='dialog']");
    await expect(sheet.getByText("政策显示已过退款期")).toBeVisible();
  });

  test("inspector shows thought stream header", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("更新客服话术模板").click();
    await page.waitForTimeout(500);

    const sheet = page.locator("[role='dialog']");
    await expect(sheet.getByText("脑回路")).toBeVisible();
  });

  test("closing inspector returns to board", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("更新客服话术模板").click();
    await page.waitForTimeout(500);

    // Close the sheet
    const closeBtn = page.locator("[role='dialog'] button").filter({ hasText: /close|×/ }).first();
    // If there's an X button, click it; otherwise press Escape
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(500);

    // Sheet should be gone
    await expect(page.locator("[role='dialog']")).not.toBeVisible();
  });
});
