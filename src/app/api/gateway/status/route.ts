import { gatewayClient } from "@/lib/gateway-client";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    connected: gatewayClient.isConnected,
    url: process.env.OPENCLAW_GATEWAY_URL || "ws://localhost:18789",
  });
}
