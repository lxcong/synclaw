import { test, expect } from "@playwright/test";
import { waitForAppReady } from "./helpers";

const BASE = "http://localhost:3003";

test.describe("Auto-tracker: API regression", () => {
  test("POST /api/tasks still works without Gateway (regression)", async ({
    request,
  }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();

    const res = await request.post(`${BASE}/api/tasks`, {
      data: {
        title: "回归测试任务",
        description: "确认基本创建流程正常",
        workspaceId: workspaces[0].id,
      },
    });
    expect(res.status()).toBe(201);
    const task = await res.json();
    expect(task.title).toBe("回归测试任务");
    expect(task.status).toBe("todo");
    expect(task.runId).toBeNull();
  });

  test("multiple tasks without runId coexist (NULL uniqueness)", async ({
    request,
  }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const wsId = workspaces[0].id;

    // Create multiple tasks without runId — should all succeed
    const res1 = await request.post(`${BASE}/api/tasks`, {
      data: { title: "无runId任务A", workspaceId: wsId },
    });
    expect(res1.status()).toBe(201);

    const res2 = await request.post(`${BASE}/api/tasks`, {
      data: { title: "无runId任务B", workspaceId: wsId },
    });
    expect(res2.status()).toBe(201);

    const task1 = await res1.json();
    const task2 = await res2.json();

    // Both should have null runId — SQLite allows multiple NULLs with @unique
    expect(task1.runId).toBeNull();
    expect(task2.runId).toBeNull();
    expect(task1.id).not.toBe(task2.id);
  });

  test("task CRUD still works end-to-end", async ({ request }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const wsId = workspaces[0].id;

    // Create
    const createRes = await request.post(`${BASE}/api/tasks`, {
      data: { title: "CRUD回归", description: "完整流程", workspaceId: wsId },
    });
    expect(createRes.status()).toBe(201);
    const task = await createRes.json();
    expect(task.title).toBe("CRUD回归");

    // Read
    const getRes = await request.get(`${BASE}/api/tasks/${task.id}`);
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.title).toBe("CRUD回归");
    expect(fetched).toHaveProperty("thoughts");
    expect(fetched).toHaveProperty("results");

    // Update
    const patchRes = await request.patch(`${BASE}/api/tasks/${task.id}`, {
      data: { status: "acting", title: "CRUD回归-更新" },
    });
    expect(patchRes.status()).toBe(200);
    const updated = await patchRes.json();
    expect(updated.status).toBe("acting");
    expect(updated.title).toBe("CRUD回归-更新");

    // Delete
    const deleteRes = await request.delete(`${BASE}/api/tasks/${task.id}`);
    expect(deleteRes.status()).toBe(204);

    const verifyRes = await request.get(`${BASE}/api/tasks/${task.id}`);
    expect(verifyRes.status()).toBe(404);
  });

  test("POST /api/tasks with agent but no Gateway falls back to todo", async ({
    request,
  }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const agentsRes = await request.get(`${BASE}/api/agents`);
    const agents = await agentsRes.json();

    if (agents.length === 0) {
      // No agents — this test only makes sense with agents available
      test.skip();
      return;
    }

    const res = await request.post(`${BASE}/api/tasks`, {
      data: {
        title: "Gateway离线测试",
        workspaceId: workspaces[0].id,
        assignedAgentId: agents[0].id,
      },
    });
    expect(res.status()).toBe(201);
    const task = await res.json();
    // Without Gateway: "acting" if dispatch succeeded, "todo" if fallback
    expect(["acting", "todo"]).toContain(task.status);
  });
});

test.describe("Task board polling", () => {
  test("new task created via API appears in board without page refresh", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Get workspaces
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const wsId = workspaces[0].id;

    // Navigate to the first workspace
    const wsButton = page.locator("aside nav button").first();
    await wsButton.click();
    await page.waitForTimeout(500);

    // Create a task via API (not through UI) to simulate an external/auto-tracked task
    const uniqueTitle = `轮询测试-${Date.now()}`;
    const createRes = await request.post(`${BASE}/api/tasks`, {
      data: { title: uniqueTitle, workspaceId: wsId },
    });
    expect(createRes.status()).toBe(201);

    // The polling interval is 5s. The task should appear without a manual page refresh.
    await expect(page.getByText(uniqueTitle).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("task status change via API reflects in board via polling", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const wsId = workspaces[0].id;

    // Navigate to the first workspace
    const wsButton = page.locator("aside nav button").first();
    await wsButton.click();
    await page.waitForTimeout(500);

    // Create a task in "todo" status
    const uniqueTitle = `状态轮询测试-${Date.now()}`;
    const createRes = await request.post(`${BASE}/api/tasks`, {
      data: { title: uniqueTitle, workspaceId: wsId },
    });
    const task = await createRes.json();

    // Wait for it to appear via polling
    await expect(page.getByText(uniqueTitle).first()).toBeVisible({
      timeout: 10_000,
    });

    // Update status to "done" via API (simulating auto-tracker lifecycle end)
    await request.patch(`${BASE}/api/tasks/${task.id}`, {
      data: { status: "done" },
    });

    // After polling, verify the task card is now in the "已完成" column
    // Use a long enough timeout to cover at least one polling cycle
    const doneColumn = page
      .locator("div")
      .filter({
        has: page.locator(".text-sm.font-medium", { hasText: "已完成" }),
      })
      .first();

    await expect(doneColumn.getByText(uniqueTitle)).toBeVisible({
      timeout: 12_000,
    });
  });
});
