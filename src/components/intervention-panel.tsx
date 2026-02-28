"use client";

import { useState } from "react";
import type { InterventionRequest } from "@/types";
import { Button } from "@/components/ui/button";

interface Props {
  intervention: InterventionRequest;
  taskId: string;
  onResolved: () => void;
}

export function InterventionPanel({ intervention, taskId, onResolved }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const options = intervention.options ?? [];

  async function handleRespond(response: string) {
    setSubmitting(true);
    await fetch(`/api/tasks/${taskId}/intervene`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    setSubmitting(false);
    onResolved();
  }

  return (
    <div
      className="p-4 rounded-lg border"
      style={{ borderColor: "var(--blocked)", background: "rgba(249, 115, 22, 0.1)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{"\u26A0\uFE0F"}</span>
        <h4 className="text-sm font-medium" style={{ color: "var(--blocked)" }}>
          {"\u9700\u8981\u4F60\u7684\u51B3\u5B9A"}
        </h4>
      </div>
      <p className="text-sm mb-4">{intervention.question}</p>
      <div className="space-y-2">
        {options.map((option) => (
          <Button
            key={option}
            variant="outline"
            size="sm"
            className="w-full justify-start cursor-pointer"
            disabled={submitting}
            onClick={() => handleRespond(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}
