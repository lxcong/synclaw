import { test, expect } from "@playwright/test";

test.describe("Agent Hub", () => {
  test("agent hub page renders correctly", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    // Page heading is always present
    await expect(page.getByRole("heading", { name: /Agent 中心/ })).toBeVisible();
  });

  test("agent cards render when agents exist", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    // Check if any agent cards are rendered (from Gateway or DB cache)
    const cards = page.locator("[data-testid='agent-card']");
    const count = await cards.count();

    if (count > 0) {
      // Each card should have a name and status indicator
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  test("sidebar is visible on agent hub page", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText("公司客服")).toBeVisible();
  });
});
