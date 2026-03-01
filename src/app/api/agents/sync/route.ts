import { syncAgentsFromGateway } from "@/lib/agent-sync";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const agents = await syncAgentsFromGateway(true);
    return NextResponse.json(agents);
  } catch (err) {
    console.error("[agents/sync] Gateway sync failed:", err);
    return NextResponse.json({ error: "Gateway sync failed" }, { status: 502 });
  }
}
