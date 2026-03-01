import "@/lib/gateway-init";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SyncClaw - Intelligent Task Console",
  description: "Executable intelligent task console with AI agent integration",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
