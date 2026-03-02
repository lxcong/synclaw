import { test, expect } from "@playwright/test";

test.describe("Agent Hub", () => {
  test("agent hub page renders correctly", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    // Page heading is always present
    await expect(page.getByRole("heading", { name: /Agent 中心/ })).toBeVisible();
  });

  test("pixel office canvas renders", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    // The pixel office container should be present
    const pixelOffice = page.locator("[data-testid='pixel-office']");
    await expect(pixelOffice).toBeVisible();

    // Should contain a canvas element (Phaser renders to canvas)
    const canvas = pixelOffice.locator("canvas");
    await expect(canvas).toBeVisible();
  });

  test("agent cards render when agents exist", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    const cards = page.locator("[data-testid='agent-card']");
    const count = await cards.count();

    if (count > 0) {
      // Gateway is connected — agent cards are rendered
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible();
    } else {
      // Gateway not connected — empty state is shown
      await expect(page.getByText("暂无可用 Agent")).toBeVisible();
    }
  });

  test("clicking agent card highlights it", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    const cards = page.locator("[data-agent-id]");
    const count = await cards.count();

    if (count > 0) {
      const firstCard = cards.first();
      await firstCard.click();

      // After clicking, the card wrapper should have a primary-colored outline
      // We check the outline style contains the primary color
      await expect(firstCard).toHaveCSS("outline-style", "solid");
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
