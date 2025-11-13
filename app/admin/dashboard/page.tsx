import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { AdminShell } from "@/components/admin/admin-shell"
import { db } from "@/lib/db"
import { AdminStats } from "@/components/admin/admin-stats"
import { PendingApprovals } from "@/components/admin/pending-approvals"
import { getUnifiedTasks, getTaskStats } from "@/lib/task-utils"

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login")
  }

  // Get system stats
  const [totalUsers, allTasksStats, pendingTasksStats, completedTasksStats] = await Promise.all([
    db.user.count(),
    getTaskStats(), // 所有任务的总数（包括未审批的）
    getTaskStats({ approved: false }), // 待审批任务
    getTaskStats({ approved: true, status: "COMPLETED" }) // 已完成任务
  ])

  const stats = {
    totalUsers,
    totalTasks: allTasksStats.total, // 所有任务总数
    pendingTasks: pendingTasksStats.total, // 待审批任务总数
    completedTasks: completedTasksStats.total, // 已完成任务总数
  }

  // Get tasks pending approval (both task and annotation task)
  const pendingTasks = await getUnifiedTasks({
    approved: false
    // 不设置 limit，显示所有待审批任务
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
