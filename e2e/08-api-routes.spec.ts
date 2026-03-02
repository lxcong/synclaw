import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3003";

test.describe("API Routes", () => {
  test("GET /api/workspaces returns workspaces", async ({ request }) => {
    const res = await request.get(`${BASE}/api/workspaces`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(3);
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("icon");
  });

  test("POST /api/workspaces creates a workspace", async ({ request }) => {
    const res = await request.post(`${BASE}/api/workspaces`, {
      data: { name: "API测试空间", icon: "🧪" },
    });
    expect(res.status()).toBe(201);
    const ws = await res.json();
    expect(ws.name).toBe("API测试空间");
    expect(ws.icon).toBe("🧪");
    expect(ws.id).toBeTruthy();
  });

  test("GET /api/agents returns agent list", async ({ request }) => {
    const res = await request.get(`${BASE}/api/agents`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // If agents exist (Gateway connected), verify shape
    if (data.length > 0) {
      expect(Array.isArray(data[0].capabilities)).toBe(true);
      expect(data[0]).toHaveProperty("_count");
    }
  });

  test("GET /api/workspaces/[id]/tasks returns tasks for workspace", async ({ request }) => {
    // Get first workspace
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const wsId = workspaces[0].id;

    const res = await request.get(`${BASE}/api/workspaces/${wsId}/tasks`);
    expect(res.status()).toBe(200);
    const tasks = await res.json();
    expect(Array.isArray(tasks)).toBe(true);
    tasks.forEach((t: Record<string, unknown>) => {
      expect(t).toHaveProperty("title");
      expect(t).toHaveProperty("status");
      expect(t.workspaceId).toBe(wsId);
    });
  });

  test("POST /api/tasks creates a task", async ({ request }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();

    const res = await request.post(`${BASE}/api/tasks`, {
      data: {
        title: "API创建的任务",
        description: "通过API创建",
        workspaceId: workspaces[0].id,
      },
    });
    expect(res.status()).toBe(201);
    const task = await res.json();
    expect(task.title).toBe("API创建的任务");
    expect(task.status).toBe("todo");
  });

  test("POST /api/tasks with agent sets status to acting or falls back to todo", async ({ request }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const agentsRes = await request.get(`${BASE}/api/agents`);
    const agents = await agentsRes.json();

    if (agents.length === 0) {
      // No agents available (Gateway not connected) — skip
      return;
    }

    const res = await request.post(`${BASE}/api/tasks`, {
      data: {
        title: "有Agent的任务",
        workspaceId: workspaces[0].id,
        assignedAgentId: agents[0].id,
      },
    });
    expect(res.status()).toBe(201);
    const task = await res.json();
    // "acting" if Gateway dispatch succeeded, "todo" if it failed and fell back
    expect(["acting", "todo"]).toContain(task.status);
  });

  test("PATCH /api/tasks/[id] updates task", async ({ request }) => {
    // Create a task first
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();

    const createRes = await request.post(`${BASE}/api/tasks`, {
      data: { title: "待更新任务", workspaceId: workspaces[0].id },
    });
    const task = await createRes.json();

    // Update it
    const updateRes = await request.patch(`${BASE}/api/tasks/${task.id}`, {
      data: { status: "done", title: "已更新任务" },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.status).toBe("done");
    expect(updated.title).toBe("已更新任务");
  });

  test("DELETE /api/tasks/[id] deletes task", async ({ request }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();

    const createRes = await request.post(`${BASE}/api/tasks`, {
      data: { title: "待删除任务", workspaceId: workspaces[0].id },
    });
    const task = await createRes.json();

    const deleteRes = await request.delete(`${BASE}/api/tasks/${task.id}`);
    expect(deleteRes.status()).toBe(204);

    // Verify it's gone
    const getRes = await request.get(`${BASE}/api/tasks/${task.id}`);
    expect(getRes.status()).toBe(404);
  });

  test("GET /api/tasks/[id] returns task with relations", async ({ request }) => {
    const wsRes = await request.get(`${BASE}/api/workspaces`);
    const workspaces = await wsRes.json();
    const tasksRes = await request.get(`${BASE}/api/workspaces/${workspaces[0].id}/tasks`);
    const tasks = await tasksRes.json();
    const taskWithAgent = tasks.find((t: Record<string, unknown>) => t.assignedAgentId);

    if (taskWithAgent) {
      const res = await request.get(`${BASE}/api/tasks/${taskWithAgent.id}`);
      expect(res.status()).toBe(200);
      const task = await res.json();
      expect(task).toHaveProperty("thoughts");
      expect(task).toHaveProperty("results");
      expect(task.assignedAgent).toBeTruthy();
    }
  });

  test("GET /api/tasks/[id] returns 404 for non-existent task", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tasks/nonexistent123`);
    expect(res.status()).toBe(404);
  });
});
