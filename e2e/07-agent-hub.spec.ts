import { test, expect } from "@playwright/test";

test.describe("Agent Hub", () => {
  test("agent hub page shows all agents", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    await expect(page.getByText("CS-Agent")).toBeVisible();
    await expect(page.getByText("Life-Agent")).toBeVisible();
    await expect(page.getByText("Fin-Agent")).toBeVisible();
  });

  test("agent cards show descriptions", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    await expect(page.getByText("客服专员")).toBeVisible();
    await expect(page.getByText("个人助理")).toBeVisible();
    await expect(page.getByText("财务助手")).toBeVisible();
  });

  test("agent cards show status indicators", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    // CS-Agent is "busy" in seed data
    await expect(page.getByText("忙碌")).toBeVisible();
    // Life-Agent and Fin-Agent are "idle"
    const idleLabels = page.getByText("空闲");
    expect(await idleLabels.count()).toBeGreaterThanOrEqual(2);
  });

  test("agent cards show capabilities", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    // CS-Agent capabilities
    await expect(page.getByText("查询订单")).toBeVisible();
    await expect(page.getByText("退款处理")).toBeVisible();

    // Fin-Agent capabilities
    await expect(page.getByText("报表生成")).toBeVisible();
    await expect(page.getByText("数据分析")).toBeVisible();
  });

  test("agent cards show task counts", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    // CS-Agent should have tasks assigned to it
    await expect(page.getByText(/任务数: [0-9]+/).first()).toBeVisible();
  });

  test("sidebar is visible on agent hub page", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("公司客服")).toBeVisible();
    await expect(sidebar.getByText("Agent 中心")).toBeVisible();
  });
});
