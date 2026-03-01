import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("Task CRUD", () => {
  test("create a new task without agent", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Open create dialog
    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);

    // Fill in the form
    await page.getByPlaceholder("输入任务标题").fill("测试新任务");
    await page.getByPlaceholder("输入任务描述（可选）").fill("这是一个测试描述");

    // Submit
    await page.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(1000);

    // Task should appear in the "待处理" column
    await expect(page.getByText("测试新任务").first()).toBeVisible();
  });

  test("create a new task with agent assignment (requires Gateway)", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);

    const dialog = page.locator("[role='dialog']");

    // Agents are synced from Gateway; skip if none available
    const agentButtons = dialog.locator("button").filter({ hasText: /🤖/ });
    const agentCount = await agentButtons.count();
    if (agentCount === 0) {
      test.skip();
      return;
    }

    await page.getByPlaceholder("输入任务标题").fill("Agent执行任务");
    await agentButtons.first().click();

    await page.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText("Agent执行任务").first()).toBeVisible();
  });

  test("create workspace via sidebar", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Click new workspace button
    await page.locator("aside").getByText("新建工作区").click();
    await page.waitForTimeout(500);

    await expect(page.getByText("新建工作区").nth(1)).toBeVisible();

    // Fill the form
    await page.getByPlaceholder("输入工作区名称").fill("测试工作区");

    // Submit
    await page.getByRole("button", { name: "创建" }).click();
    await page.waitForTimeout(1000);

    // Should navigate to new workspace
    await expect(page.locator("aside").getByText("测试工作区").first()).toBeVisible();
  });
});
