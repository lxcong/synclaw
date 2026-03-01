import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

test.describe("Kanban Board", () => {
  test("displays five status columns", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // All five column headers should be visible
    await expect(page.getByText("待处理")).toBeVisible();
    await expect(page.getByText("思考中")).toBeVisible();
    await expect(page.getByText("执行中")).toBeVisible();
    await expect(page.getByText("待干预")).toBeVisible();
    await expect(page.getByText("已完成")).toBeVisible();
  });

  test("shows seeded tasks in correct columns", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Navigate to 公司客服 workspace (should be default)
    await page.locator("aside").getByText("公司客服").click();
    await page.waitForTimeout(1000);

    // Check specific tasks are visible
    await expect(page.getByText("处理张三的退款请求")).toBeVisible();
    await expect(page.getByText("回复李四的咨询邮件")).toBeVisible();
    await expect(page.getByText("VVIP 客户退款超期审批")).toBeVisible();
    await expect(page.getByText("更新客服话术模板")).toBeVisible();
  });

  test("task cards render without errors when no agents assigned", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Seed tasks have no assigned agents; verify cards render correctly
    await expect(page.getByText("处理张三的退款请求")).toBeVisible();
  });

  test("new task button opens create dialog", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    await page.getByText("+ 新建任务").click();
    await expect(page.getByText("新建任务").nth(1)).toBeVisible();
    await expect(page.getByPlaceholder("输入任务标题")).toBeVisible();
  });

  test("can switch between workspaces and see different tasks", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Switch to 财务自动化
    await page.locator("aside").getByText("财务自动化").click();
    await page.waitForTimeout(1000);

    await expect(page.getByText("整理本月财务报表")).toBeVisible();
    // CS tasks should not be visible
    await expect(page.getByText("处理张三的退款请求")).not.toBeVisible();
  });
});
