import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { TaskForm } from "@/components/tasks/task-form";

export default async function CreateTaskPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "PUBLISHER" && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // 获取所有分类
  const categories = await db.category.findMany({
    orderBy: {
      name: "asc",
    },
  });

  // 获取所有任务类型
  const taskTypes = await db.taskType.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return (
    <DashboardShell>
      <DashboardHeader heading="创建任务" text="发布新的任务给大家接单" />
      <TaskForm categories={categories} taskTypes={taskTypes} />
    </DashboardShell>
  );
}
