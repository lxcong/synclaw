import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function Home() {
  const firstWorkspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (firstWorkspace) {
    redirect(`/workspace/${firstWorkspace.id}`);
  }
  return (
    <div className="flex h-screen items-center justify-center">
      <p style={{ color: "var(--muted-foreground)" }}>创建你的第一个工作区开始使用</p>
    </div>
  );
}
