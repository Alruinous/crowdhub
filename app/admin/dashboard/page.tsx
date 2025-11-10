import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { AdminShell } from "@/components/admin/admin-shell"
import { db } from "@/lib/db"
import { AdminStats } from "@/components/admin/admin-stats"
import { PendingApprovals } from "@/components/admin/pending-approvals"

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login")
  }

  // Get system stats
  const stats = {
    totalUsers: await db.user.count(),
    totalTasks: await db.task.count(),
    pendingTasks: await db.task.count({ where: { approved: false } }),
    completedTasks: await db.task.count({ where: { status: "COMPLETED" } }),
  }

  // Get tasks pending approval
  const pendingTasks = await db.task.findMany({
    where: { approved: false },
    orderBy: { createdAt: "desc" },
    include: {
      publisher: {
        select: { name: true },
      },
      category: true,
    },
  })

  return (
    <AdminShell>
      <DashboardHeader heading="管理员仪表盘" text="系统概览和待处理事项" />

      <AdminStats stats={stats} />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">待审批任务</h2>
        <PendingApprovals tasks={pendingTasks} />
      </div>
    </AdminShell>
  )
}
