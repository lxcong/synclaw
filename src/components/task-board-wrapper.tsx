"use client";

import { TopBar } from "@/components/top-bar";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export function TaskBoardWrapper({ workspaceName }: Props) {
  return (
    <>
      <TopBar title={workspaceName} onNewTask={() => {}} />
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--muted)" }}>
        任务看板（下一步实现）
      </div>
    </>
  );
}
