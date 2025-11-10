import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { AdminShell } from "@/components/admin/admin-shell"
import { db } from "@/lib/db"
import { TaskManagement } from "@/components/admin/task-management"

export default async function AdminTasksPage({ searchParams }) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login")
  }

  // Parse search params
  const status = searchParams.status || "ALL"
  const approved = searchParams.approved || "ALL"
  const search = searchParams.search || ""
  const page = Number.parseInt(searchParams.page || "1")
  const limit = 10
  const skip = (page - 1) * limit

  // Build filter conditions
  const where = {
    status: status !== "ALL" ? status : undefined,
    approved: approved === "true" ? true : approved === "false" ? false : undefined,
    OR: search ? [{ title: { contains: search } }, { description: { contains: search } }] : undefined,
  }

  // Get tasks
  const tasks = await db.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    include: {
      publisher: {
        select: { name: true },
      },
      category: true,
      _count: {
        select: { subtasks: true },
      },
    },
  })

  // Get total count for pagination
  const totalTasks = await db.task.count({ where })
  const totalPages = Math.ceil(totalTasks / limit)

  return (
    <AdminShell>
      <DashboardHeader heading="任务管理" text="管理系统任务" />

      <TaskManagement
        tasks={tasks}
        pagination={{
          currentPage: page,
          totalPages,
        }}
      />
    </AdminShell>
  )
}
