import type { ThoughtType } from "@/types";

export interface MockEvent {
  type: "status_change" | "thought" | "intervention" | "result";
  delay: number; // ms before this event fires
  data: Record<string, unknown>;
}

const defaultScenario: MockEvent[] = [
  {
    type: "status_change",
    delay: 0,
    data: { status: "thinking" },
  },
  {
    type: "thought",
    delay: 1500,
    data: { thoughtType: "thinking" as ThoughtType, content: "正在分析任务需求..." },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "thinking" as ThoughtType, content: "制定执行计划，分为 3 个步骤" },
  },
  {
    type: "status_change",
    delay: 1000,
    data: { status: "acting" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "tool_use" as ThoughtType, content: "正在查询相关数据...", toolName: "数据库查询" },
  },
  {
    type: "thought",
    delay: 3000,
    data: { thoughtType: "result" as ThoughtType, content: "找到 3 条相关记录" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "tool_use" as ThoughtType, content: "正在核对业务规则...", toolName: "规则引擎" },
  },
  {
    type: "intervention",
    delay: 2000,
    data: {
      question: "检测到特殊情况，需要您确认处理方式",
      options: JSON.stringify(["按标准流程处理", "特殊审批通过", "暂时搁置"]),
    },
  },
  // After intervention is resolved, the stream continues
  {
    type: "status_change",
    delay: 500,
    data: { status: "acting" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "tool_use" as ThoughtType, content: "正在执行最终操作...", toolName: "操作执行器" },
  },
  {
    type: "thought",
    delay: 2000,
    data: { thoughtType: "result" as ThoughtType, content: "操作完成，生成执行报告" },
  },
  {
    type: "result",
    delay: 1000,
    data: {
      resultType: "text",
      title: "执行报告",
      content: "任务已成功完成。处理了 3 条记录，所有操作均已确认。",
    },
  },
  {
    type: "status_change",
    delay: 500,
    data: { status: "done" },
  },
];

export function getMockScenario(): MockEvent[] {
  return defaultScenario;
}
