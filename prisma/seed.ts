import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data
  await prisma.interventionRequest.deleteMany();
  await prisma.taskResult.deleteMany();
  await prisma.thoughtEntry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.workspace.deleteMany();

  // Create workspaces
  const csWorkspace = await prisma.workspace.create({
    data: { name: "公司客服", icon: "🎧", description: "客户服务相关任务" },
  });
  const lifeWorkspace = await prisma.workspace.create({
    data: { name: "个人生活", icon: "🏠", description: "个人事务管理" },
  });
  const finWorkspace = await prisma.workspace.create({
    data: { name: "财务自动化", icon: "💰", description: "财务流程自动化" },
  });

  // Create test agents (these serve as fallback when Gateway is not connected)
  const csAgent = await prisma.agent.create({
    data: {
      id: "seed-cs-agent",
      name: "CS-Agent",
      description: "客服专员，擅长处理客户咨询、退款和投诉",
      capabilities: JSON.stringify(["查询订单", "退款处理", "邮件回复", "客户信息查询"]),
      status: "busy",
      lastHeartbeat: new Date(),
    },
  });
  await prisma.agent.create({
    data: {
      id: "seed-life-agent",
      name: "Life-Agent",
      description: "个人助理，管理日程、提醒和日常事务",
      capabilities: JSON.stringify(["日历管理", "提醒设置", "信息搜索", "文件整理"]),
      status: "idle",
      lastHeartbeat: new Date(),
    },
  });
  await prisma.agent.create({
    data: {
      id: "seed-fin-agent",
      name: "Fin-Agent",
      description: "财务助手，处理报表、对账和财务分析",
      capabilities: JSON.stringify(["报表生成", "数据分析", "对账核算", "预算管理"]),
      status: "idle",
      lastHeartbeat: new Date(),
    },
  });

  // Create tasks
  await prisma.task.create({
    data: {
      title: "处理张三的退款请求",
      description: "客户要求退还上月订单 #20241201 的费用",
      status: "acting",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "回复李四的咨询邮件",
      description: "关于产品升级方案的问题",
      status: "thinking",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "VVIP 客户退款超期审批",
      description: "政策显示已过退款期，但该用户是 VVIP",
      status: "blocked",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "更新客服话术模板",
      description: "根据最新产品线调整标准回复模板",
      status: "done",
      workspaceId: csWorkspace.id,
      assignedAgentId: csAgent.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "整理本月财务报表",
      description: "汇总 2 月份所有收支数据",
      status: "todo",
      workspaceId: finWorkspace.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "预约下周牙医",
      description: "周三或周四下午",
      status: "todo",
      workspaceId: lifeWorkspace.id,
    },
  });

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
