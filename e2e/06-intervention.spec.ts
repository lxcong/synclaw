import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("Intervention Flow", () => {
  test("intervention panel appears when agent gets blocked", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Create a task that will trigger the mock intervention
    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder("输入任务标题").fill("干预测试任务");
    const dialog1 = page.locator("[role='dialog']");
    await dialog1.getByRole("button", { name: "CS-Agent" }).click();
    await dialog1.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(1500);

    // Open inspector
    await page.getByText("干预测试任务").first().click();

    // Wait for intervention to appear (~14.5s into scenario)
    const sheet = page.locator("[role='dialog']");
    await expect(sheet.getByText("需要你的决定")).toBeVisible({ timeout: 25000 });
    await expect(sheet.getByText("检测到特殊情况")).toBeVisible();

    // Intervention options should be shown
    await expect(sheet.getByText("按标准流程处理")).toBeVisible();
    await expect(sheet.getByText("特殊审批通过")).toBeVisible();
    await expect(sheet.getByText("暂时搁置")).toBeVisible();
  });

  test("responding to intervention resumes task execution", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Create a task
    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder("输入任务标题").fill("干预恢复测试");
    const dialog2 = page.locator("[role='dialog']");
    await dialog2.getByRole("button", { name: "CS-Agent" }).click();
    await dialog2.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(1500);

    await page.getByText("干预恢复测试").first().click();

    const sheet = page.locator("[role='dialog']");

    // Wait for intervention
    await expect(sheet.getByText("需要你的决定")).toBeVisible({ timeout: 25000 });

    // Respond to intervention
    await sheet.getByText("特殊审批通过").click();
    await page.waitForTimeout(3000);

    // After responding, the task should continue executing
    // New thoughts should appear after the intervention
    await expect(sheet.getByText("正在执行最终操作")).toBeVisible({ timeout: 10000 });
  });
});
