import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data
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

  // Create tasks
  await prisma.task.create({
    data: {
      title: "处理张三的退款请求",
      description: "客户要求退还上月订单 #20241201 的费用",
      status: "todo",
      workspaceId: csWorkspace.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "回复李四的咨询邮件",
      description: "关于产品升级方案的问题",
      status: "todo",
      workspaceId: csWorkspace.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "VVIP 客户退款超期审批",
      description: "政策显示已过退款期，但该用户是 VVIP",
      status: "todo",
      workspaceId: csWorkspace.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "更新客服话术模板",
      description: "根据最新产品线调整标准回复模板",
      status: "done",
      workspaceId: csWorkspace.id,
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
