import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await hash("000000", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@raids.io" },
    update: {},
    create: {
      email: "admin@raids.io",
      name: "Admin",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Create example WORKER and PUBLISHER users
  const workerPassword = await hash("000000", 10);
  const worker = await prisma.user.upsert({
    where: { email: "worker@raids.io" },
    update: {},
    create: {
      email: "worker@raids.io",
      name: "Worker",
      password: workerPassword,
      role: "WORKER",
    },
  });

  const publisherPassword = await hash("000000", 10);
  const publisher = await prisma.user.upsert({
    where: { email: "publisher@raids.io" },
    update: {},
    create: {
      email: "publisher@raids.io",
      name: "Publisher",
      password: publisherPassword,
      role: "PUBLISHER",
    },
  });

  // Create categories
  const categories = [
    "数学",
    "生态环境",
    "生命科学",
    "科学教育理论",
    "航天",
    "天文学",
    "化学",
    "物理",
    "科学与艺术",
    "技术与工程",
    "健康卫生",
    "气象海洋",
    "心理学",
    "人工智能与机器人",
    "军事",
    "其他",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Categories created");

  // Create task types
  const taskTypes = ["科学辟谣", "社区", "科教", "博物馆"];

  for (const name of taskTypes) {
    await prisma.taskType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Task Types created");

  // Create default AI configs
  const defaultConfigs = [
    {
      key: "baseURL",
      value: "https://api.deepseek.com",
      label: "AI 服务器地址",
    },
    {
      key: "model",
      value: "deepseek-chat",
      label: "AI 模型",
    },
    { key: "temperature", value: "1.0", label: "温度参数" },
    {
      key: "systemPrompt",
      value:
        "你是一个任务分解助手，能够根据任务描述和接单者数量将任务合理地分解为子任务。返回的内容必须是合法的JSON格式。",
      label: "系统提示词",
    },
    {
      key: "apiKey",
      value: process.env.DEEPSEEK_API_KEY || "", // 从 .env 文件读取
      label: "API 密钥",
    },
  ];

  for (const config of defaultConfigs) {
    await prisma.aiConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: { key: config.key, value: config.value, label: config.label },
    });
  }

  console.log("AI Configs created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
