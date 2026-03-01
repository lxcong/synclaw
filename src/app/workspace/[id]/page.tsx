import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { TaskBoardWrapper } from "@/components/task-board-wrapper";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  return <TaskBoardWrapper workspaceId={id} workspaceName={workspace.name} />;
}
