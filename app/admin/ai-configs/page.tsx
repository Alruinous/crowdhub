import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AdminShell } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { AIManagement } from "@/components/admin/ai-management";

export default async function AdminAIConfigsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // 获取所有 AI 配置
  const configs = await db.aiConfig.findMany({
    orderBy: { key: "asc" },
  });

  // 对配置中的 apiKey 部分，如果存在，则隐藏
  const sanitizedConfigs = configs.map((config) => {
    if (config.key === "apiKey") {
      return { ...config, value: "******" };
    }
    return config;
  });

  return (
    <AdminShell>
      <DashboardHeader heading="AI 配置管理" text="管理 AI 服务相关配置" />

      <AIManagement configs={sanitizedConfigs} />
    </AdminShell>
  );
}
