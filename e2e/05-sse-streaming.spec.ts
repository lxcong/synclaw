import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("SSE Real-time Streaming", () => {
  test("opening inspector on active task starts thought stream", async ({ page }) => {
    // First create a new task with agent to trigger fresh stream
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);

    await page.getByPlaceholder("输入任务标题").fill("SSE测试任务");
    // Assign to CS-Agent inside dialog
    const dialog1 = page.locator("[role='dialog']");
    await dialog1.getByRole("button", { name: "CS-Agent" }).click();
    await dialog1.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(1500);

    // Click the new task to open inspector
    await page.getByText("SSE测试任务").first().click();
    await page.waitForTimeout(3000);

    // Should see thought entries appearing
    const sheet = page.locator("[role='dialog']");
    await expect(sheet.getByText("脑回路")).toBeVisible();

    // Wait for the first thought to appear (mock engine has 1.5s delay)
    await expect(sheet.getByText("正在分析任务需求")).toBeVisible({ timeout: 10000 });
  });

  test("thought stream shows tool usage entries", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Create a fresh task with agent
    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder("输入任务标题").fill("工具使用测试");
    const dialog2 = page.locator("[role='dialog']");
    await dialog2.getByRole("button", { name: "CS-Agent" }).click();
    await dialog2.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(1500);

    await page.getByText("工具使用测试").first().click();

    // Wait for tool_use thoughts to appear (after ~6.5s of scenario time)
    const sheet = page.locator("[role='dialog']");
    await expect(sheet.getByText("数据库查询")).toBeVisible({ timeout: 15000 });
  });

  test("SSE stream does NOT start for done tasks", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Click a done task
    await page.getByText("更新客服话术模板").click();
    await page.waitForTimeout(2000);

    const sheet = page.locator("[role='dialog']");
    // Should show "等待 Agent 开始执行" (no stream connected)
    await expect(sheet.getByText("等待 Agent 开始执行")).toBeVisible();

    // Status should remain "已完成", NOT reset to "思考中"
    await expect(sheet.getByText("已完成")).toBeVisible();
  });

  test("SSE stream does NOT start for unassigned tasks", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Switch to 财务 workspace to find an unassigned task
    await page.locator("aside").getByText("财务自动化").click();
    await page.waitForTimeout(1000);

    await page.getByText("整理本月财务报表").click();
    await page.waitForTimeout(2000);

    const sheet = page.locator("[role='dialog']");
    // Should show waiting message, not crash
    await expect(sheet.getByText("等待 Agent 开始执行")).toBeVisible();
    await expect(sheet.getByText("待处理")).toBeVisible();
  });
});
