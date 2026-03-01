import { gatewayClient } from "@/lib/gateway-client";
import { syncAgentsFromGateway, getAgentsWithInferredStatus } from "@/lib/agent-sync";
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
  const agents = await getAgentsWithInferredStatus();
  return NextResponse.json(agents);
}
