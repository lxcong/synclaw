import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const body = await request.json();

  const intervention = await prisma.interventionRequest.findFirst({
    where: { taskId, resolvedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!intervention) {
    return NextResponse.json({ error: "No pending intervention" }, { status: 404 });
  }

  const updated = await prisma.interventionRequest.update({
    where: { id: intervention.id },
    data: { response: body.response, resolvedAt: new Date() },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "acting" },
  });

  return NextResponse.json(updated);
}
