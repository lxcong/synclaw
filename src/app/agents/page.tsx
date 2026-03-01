import { gatewayClient } from "@/lib/gateway-client";
import { syncAgentsFromGateway, getAgentsWithInferredStatus } from "@/lib/agent-sync";
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
      agentList = (await getAgentsWithInferredStatus()) as (Agent & {
        _count: { tasks: number };
      })[];
    }
  } else {
    agentList = (await getAgentsWithInferredStatus()) as (Agent & {
      _count: { tasks: number };
    })[];
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
