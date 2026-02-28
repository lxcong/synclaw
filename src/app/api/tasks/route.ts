import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      workspaceId: body.workspaceId,
      assignedAgentId: body.assignedAgentId,
      status: body.assignedAgentId ? "thinking" : "todo",
    },
    include: { assignedAgent: true },
  });
  return NextResponse.json(task, { status: 201 });
}
