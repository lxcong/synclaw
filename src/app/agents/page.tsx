import { prisma } from "@/lib/db";
import { gatewayClient } from "@/lib/gateway-client";
import { syncAgentsFromGateway } from "@/lib/agent-sync";
import { AgentCard } from "@/components/agent-card";
import type { Agent } from "@/types";

export default async function AgentsPage() {
  let agentList: (Agent & { _count: { tasks: number } })[];

  // Sync from Gateway if connected
  if (gatewayClient.isConnected) {
    try {
      agentList = (await syncAgentsFromGateway()) as (Agent & {
        _count: { tasks: number };
      })[];
    } catch {
      // Fallback to cached DB data
      agentList = await fallbackFromDB();
    }
  } else {
    agentList = await fallbackFromDB();
  }

  return (
    <div className="flex flex-col h-full">
      <header
        className="h-14 px-6 border-b flex items-center shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-lg font-semibold">🤖 Agent 中心</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {agentList.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

async function fallbackFromDB() {
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  });
  return agents.map((a) => ({
    ...a,
    capabilities: JSON.parse(a.capabilities) as string[],
  })) as (Agent & { _count: { tasks: number } })[];
}
