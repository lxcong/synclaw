"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { ThoughtEntry, TaskResult, TaskStatus } from "@/types";

interface StreamState {
  thoughts: ThoughtEntry[];
  results: TaskResult[];
  status: TaskStatus | null;
  connected: boolean;
}

export function useTaskStream(taskId: string | null) {
  const [state, setState] = useState<StreamState>({
    thoughts: [],
    results: [],
    status: null,
    connected: false,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((s) => ({ ...s, connected: false }));
  }, []);

  useEffect(() => {
    if (!taskId) {
      disconnect();
      return;
    }

    // Reset state for new task
    setState({
      thoughts: [],
      results: [],
      status: null,
      connected: false,
    });

    // Load existing thoughts and results
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((task) => {
        setState((s) => ({
          ...s,
          thoughts: task.thoughts ?? [],
          results: task.results ?? [],
          status: task.status,
        }));

        // Only connect SSE for actively processing tasks
        if (task.status === "acting") {
          const es = new EventSource(`/api/tasks/${taskId}/stream`);
          eventSourceRef.current = es;

          es.onopen = () => {
            setState((s) => ({ ...s, connected: true }));
          };

          es.addEventListener("status_change", (e) => {
            const data = JSON.parse(e.data);
            setState((s) => ({ ...s, status: data.status }));
          });

          es.addEventListener("thought", (e) => {
            const thought = JSON.parse(e.data);
            setState((s) => ({
              ...s,
              thoughts: [...s.thoughts, thought],
            }));
          });

          es.addEventListener("result", (e) => {
            const result = JSON.parse(e.data);
            setState((s) => ({
              ...s,
              results: [...s.results, result],
            }));
          });

          es.onerror = () => {
            setState((s) => ({ ...s, connected: false }));
          };
        }
      });

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [taskId, disconnect]);

  return { ...state, disconnect };
}
