import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TaskList } from "@/components/dashboard/task-list"
import { db } from "@/lib/db"
import { UserStats } from "@/components/dashboard/user-stats"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Get user stats
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      role: true,
      points: true,
      _count: {
        select: {
          publishedTasks: true,
          claimedTasks: true,
        },
      },
    },
  })

  // Get tasks based on user role
  let tasks = []
  if (session.user.role === "PUBLISHER") {
    tasks = await db.task.findMany({
      where: { publisherId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: {
          select: { subtasks: true },
        },
        category: true,
      },
    })
  } else if (session.user.role === "WORKER") {
    tasks = await db.subtask.findMany({
      where: {
        workerId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        task: {
          include: {
            category: true,
          },
        },
      },
    })
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="仪表盘" text="查看您的任务和统计信息" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UserStats user={user} />
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">
          {session.user.role === "PUBLISHER" ? "我发布的任务" : "我认领的任务"}
        </h2>
        <TaskList tasks={tasks} userRole={session.user.role} />
      </div>
    </DashboardShell>
  )
}
