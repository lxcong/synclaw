import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "asc" },
  });
  const parsed = agents.map((a) => ({
    ...a,
    capabilities: JSON.parse(a.capabilities),
  }));
  return NextResponse.json(parsed);
}
