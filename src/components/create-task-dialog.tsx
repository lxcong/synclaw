"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Agent } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreate: (task: { title: string; description: string; assignedAgentId?: string }) => void;
}

export function CreateTaskDialog({ open, onOpenChange, workspaceId, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetch("/api/agents")
        .then((r) => r.json())
        .then(setAgents);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      assignedAgentId: selectedAgentId || undefined,
    });
    setTitle("");
    setDescription("");
    setSelectedAgentId("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              标题
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              描述
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入任务描述（可选）"
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              指派 Agent（可选）
            </label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedAgentId("")}
                className="w-full text-left px-3 py-2 rounded text-sm cursor-pointer"
                style={{
                  background: !selectedAgentId ? "var(--primary)" : "var(--background)",
                  color: !selectedAgentId ? "white" : "var(--muted-foreground)",
                }}
              >
                不指派（手动处理）
              </button>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className="w-full text-left px-3 py-2 rounded text-sm cursor-pointer"
                  style={{
                    background: selectedAgentId === agent.id ? "var(--primary)" : "var(--background)",
                    color: selectedAgentId === agent.id ? "white" : "var(--muted-foreground)",
                  }}
                >
                  🤖 {agent.name} — {agent.description}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={!title.trim()}>
            创建任务
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
