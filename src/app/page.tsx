import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { CreateWorkspaceForm } from "@/components/create-workspace-form";

export default async function Home() {
  let firstWorkspace = null;
  try {
    firstWorkspace = await prisma.workspace.findFirst({
      orderBy: { createdAt: "asc" },
    });
  } catch {
    // Table may not exist yet — show creation UI
  }

  if (firstWorkspace) {
    redirect(`/workspace/${firstWorkspace.id}`);
  }

  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: "var(--background)" }}
    >
      <CreateWorkspaceForm />
    </div>
  );
}
