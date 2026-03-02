"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to create workspace");
      const workspace = await res.json();
      router.push(`/workspace/${workspace.id}`);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div
      className="w-full max-w-sm p-6 rounded-lg border"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
      }}
    >
      <h1 className="text-lg font-semibold mb-1">SyncLaw</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
        创建你的第一个工作区开始使用
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="工作区名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full px-3 py-2 rounded-md border text-sm mb-4 outline-none"
          style={{
            borderColor: "var(--border)",
            background: "var(--background)",
            color: "var(--foreground)",
          }}
        />
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="w-full px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: "var(--primary)",
            color: "white",
          }}
        >
          {loading ? "创建中..." : "创建工作区"}
        </button>
      </form>
    </div>
  );
}
