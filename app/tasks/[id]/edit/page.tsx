import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { TaskForm } from "@/components/tasks/task-form";

interface TaskEditPageProps {
  params: {
    id: string;
  };
}

export default async function TaskEditPage({ params }: TaskEditPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const task = await db.task.findUnique({
    where: {
      id: params.id,
    },
    include: {
      subtasks: true,
    },
  });

  if (!task) {
    redirect("/dashboard");
  }

  // 只有任务发布者或管理员可以编辑
  if (session.user.id !== task.publisherId && session.user.role !== "ADMIN") {
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
      <DashboardHeader heading="编辑任务" text="修改现有任务信息" />
      <TaskForm categories={categories} taskTypes={taskTypes} task={task} />
    </DashboardShell>
  );
}
