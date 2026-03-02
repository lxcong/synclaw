import { gatewayClient } from "@/lib/gateway-client";
import { syncAgentsFromGateway, getAgentsWithInferredStatus } from "@/lib/agent-sync";
import { AgentsPageClient } from "@/components/agents-page-client";
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

  return <AgentsPageClient initialAgents={agentList} />;
}
