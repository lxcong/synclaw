import { prisma } from "@/lib/db";
import { AgentCard } from "@/components/agent-card";
import type { Agent } from "@/types";

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "asc" },
  });

  const parsed = agents.map((a) => ({
    ...a,
    capabilities: JSON.parse(a.capabilities) as string[],
  })) as (Agent & { _count: { tasks: number } })[];

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
          {parsed.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
