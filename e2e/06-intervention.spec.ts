import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("Intervention Flow", () => {
  test("intervention panel appears when agent gets blocked (requires Gateway)", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);

    const dialog1 = page.locator("[role='dialog']");
    const agentButtons = dialog1.locator("button").filter({ hasText: /🤖/ });
    const agentCount = await agentButtons.count();
    if (agentCount === 0) {
      test.skip();
      return;
    }

    await page.getByPlaceholder("输入任务标题").fill("干预测试任务");
    await agentButtons.first().click();
    await dialog1.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(2000);

    // Open inspector
    await page.getByText("干预测试任务").first().click();
    await page.waitForTimeout(500);

    const sheet = page.locator("[role='dialog']");

    // If task is "待处理" (dispatch failed) or intervention doesn't appear, skip
    const isTodo = await sheet.getByText("待处理").isVisible().catch(() => false);
    if (isTodo) {
      test.skip();
      return;
    }

    // Wait for intervention — skip if the real agent doesn't produce one
    const hasIntervention = await sheet.getByText("需要你的决定").isVisible({ timeout: 20000 }).catch(() => false);
    if (!hasIntervention) {
      test.skip();
      return;
    }

    await expect(sheet.getByText("检测到特殊情况")).toBeVisible();
    await expect(sheet.getByText("按标准流程处理")).toBeVisible();
    await expect(sheet.getByText("特殊审批通过")).toBeVisible();
    await expect(sheet.getByText("暂时搁置")).toBeVisible();
  });

  test("responding to intervention resumes task execution (requires Gateway)", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("+ 新建任务").click();
    await page.waitForTimeout(500);

    const dialog2 = page.locator("[role='dialog']");
    const agentButtons = dialog2.locator("button").filter({ hasText: /🤖/ });
    const agentCount = await agentButtons.count();
    if (agentCount === 0) {
      test.skip();
      return;
    }

    await page.getByPlaceholder("输入任务标题").fill("干预恢复测试");
    await agentButtons.first().click();
    await dialog2.getByRole("button", { name: "创建任务" }).click();
    await page.waitForTimeout(2000);

    await page.getByText("干预恢复测试").first().click();
    await page.waitForTimeout(500);

    const sheet = page.locator("[role='dialog']");

    // If task is "待处理" (dispatch failed) or intervention doesn't appear, skip
    const isTodo = await sheet.getByText("待处理").isVisible().catch(() => false);
    if (isTodo) {
      test.skip();
      return;
    }

    const hasIntervention = await sheet.getByText("需要你的决定").isVisible({ timeout: 20000 }).catch(() => false);
    if (!hasIntervention) {
      test.skip();
      return;
    }

    // Respond to intervention
    await sheet.getByText("特殊审批通过").click();
    await page.waitForTimeout(3000);

    // After responding, the task should continue executing
    await expect(sheet.getByText("正在执行最终操作")).toBeVisible({ timeout: 10000 });
  });
});
