import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tasks = await prisma.task.findMany({
    where: { workspaceId: id },
    include: { assignedAgent: true },
    orderBy: { createdAt: "asc" },
  });
  const parsed = tasks.map((t) => ({
    ...t,
    assignedAgent: t.assignedAgent
      ? { ...t.assignedAgent, capabilities: JSON.parse(t.assignedAgent.capabilities) }
      : null,
  }));
  return NextResponse.json(parsed);
}
