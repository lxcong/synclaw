import { prisma } from "@/lib/db";
import { gatewayClient } from "@/lib/gateway-client";
import { syncAgentsFromGateway } from "@/lib/agent-sync";
import { NextResponse } from "next/server";

export async function GET() {
  // If Gateway is connected, sync agents first
  if (gatewayClient.isConnected) {
    try {
      const agents = await syncAgentsFromGateway();
      return NextResponse.json(agents);
    } catch (err) {
      console.error("[agents/GET] Gateway sync failed, falling back to DB:", err);
    }
  }

  // Fallback: return cached agents from DB
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  });

  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => {
      const activeTasks = await prisma.task.count({
        where: {
          assignedAgentId: agent.id,
          status: { in: ["thinking", "acting"] },
        },
      });
      return {
        ...agent,
        status: activeTasks > 0 ? "busy" : "idle",
        capabilities: JSON.parse(agent.capabilities) as string[],
      };
    })
  );

  return NextResponse.json(agentsWithStatus);
}
