import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TaskList } from "@/components/dashboard/task-list"
import { db } from "@/lib/db"
import { UserStats } from "@/components/dashboard/user-stats"
import { getUnifiedTasks } from "@/lib/task-utils"

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
          publishedAnnotationTasks: true,  // 添加标注任务统计
          claimedTasks: true,
        },
      },
    },
  })

  // Get tasks based on user role
  let tasks: any[] = []
  
  if (session.user.role === "PUBLISHER") {
    // 发布者：只获取发布的任务
    tasks = await getUnifiedTasks({
      publisherId: session.user.id,
      approved: undefined, // 显示所有任务，包括未审批的
      limit: 5,
      taskType: "ALL"
    })
  } else if (session.user.role === "WORKER") {
    // 接单者：获取认领的普通任务和标注任务
    const [claimedTasks, claimedAnnotationTasks] = await Promise.all([
      // 获取接单者认领的普通任务子任务
      db.subtask.findMany({
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
      }),
      // 获取接单者认领的标注任务子任务
      db.annotationSubtask.findMany({
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
    ])
    tasks = [
      ...claimedTasks,
      ...claimedAnnotationTasks.map(subtask => ({ 
        ...subtask, 
        task: { ...subtask.task, taskType: "标注任务" } 
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5) // 只显示最新的5个
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="仪表盘" text="查看您的任务和统计信息" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UserStats user={user} />
      </div>

      {session.user.role === "PUBLISHER" ? (
        // 发布者：只显示我发布的任务
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">我发布的任务</h2>
          <TaskList tasks={tasks} userRole={session.user.role} />
        </div>
      ) : (
        // 接单者：只显示我认领的任务
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">我认领的任务</h2>
          <TaskList tasks={tasks} userRole={session.user.role} />
        </div>
      )}
    </DashboardShell>
  )
}
