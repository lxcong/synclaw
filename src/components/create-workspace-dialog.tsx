"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ICONS = ["📁", "🎧", "🏠", "💰", "📊", "🚀", "🎯", "📝"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, icon: string) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), icon);
    setName("");
    setIcon("📁");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <DialogHeader>
          <DialogTitle>新建工作区</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              图标
            </label>
            <div className="flex gap-2">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className="w-8 h-8 rounded flex items-center justify-center text-lg cursor-pointer"
                  style={{
                    background: icon === i ? "var(--primary)" : "var(--background)",
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              名称
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入工作区名称"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            创建
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
