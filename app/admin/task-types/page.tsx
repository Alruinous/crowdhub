import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AdminShell } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { TaskTypeManagement } from "@/components/admin/task-type-management";

export default async function AdminTaskTypesPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // 获取任务类型及相关联的任务数量
  const taskTypes = await db.taskType.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { tasks: true },
      },
    },
  });

  return (
    <AdminShell>
      <DashboardHeader heading="任务类型管理" text="管理任务类型" />

      <TaskTypeManagement taskTypes={taskTypes} />
    </AdminShell>
  );
}
