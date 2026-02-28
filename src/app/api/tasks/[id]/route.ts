import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedAgent: true,
      thoughts: { orderBy: { timestamp: "asc" } },
      results: { orderBy: { createdAt: "asc" } },
      interventions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({
    ...task,
    assignedAgent: task.assignedAgent
      ? { ...task.assignedAgent, capabilities: JSON.parse(task.assignedAgent.capabilities) }
      : null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.assignedAgentId !== undefined && { assignedAgentId: body.assignedAgentId }),
    },
    include: { assignedAgent: true },
  });
  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.interventionRequest.deleteMany({ where: { taskId: id } });
  await prisma.taskResult.deleteMany({ where: { taskId: id } });
  await prisma.thoughtEntry.deleteMany({ where: { taskId: id } });
  await prisma.task.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
