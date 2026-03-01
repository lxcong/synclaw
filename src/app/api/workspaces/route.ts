import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(workspaces);
}

export async function POST(request: Request) {
  const body = await request.json();
  const workspace = await prisma.workspace.create({
    data: {
      name: body.name,
      icon: body.icon ?? "📁",
      description: body.description,
    },
  });
  return NextResponse.json(workspace, { status: 201 });
}
