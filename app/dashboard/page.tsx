import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TaskList } from "@/components/dashboard/task-list"
import { db } from "@/lib/db"
import { UserStats } from "@/components/dashboard/user-stats"
import { getUnifiedTasks, getTaskStats } from "@/lib/task-utils"
import { TaskSearch } from "@/components/dashboard/task-search"
import { TaskTypeFilter } from "@/components/dashboard/task-type-filter"

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; taskType?: string }> }) {
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
          claimedAnnotationSubtasks: true, // 添加认领的标注子任务统计
        },
      },
    },
  })

  // 统计已完成任务数量
  const completedTasksCount = session.user.role === "PUBLISHER"
    ? await db.task.count({
        where: {
          publisherId: session.user.id,
          status: "COMPLETED",
        },
      }) + await db.annotationTask.count({
        where: {
          publisherId: session.user.id,
          status: "COMPLETED",
        },
      })
    : await db.subtask.count({
        where: {
          workerId: session.user.id,
          status: "COMPLETED",
        },
      }) + await db.annotationSubtask.count({
        where: {
          workerId: session.user.id,
          status: "COMPLETED",
        },
      })

  // Get tasks based on user role
  let tasks: any[] = []

  // 兼容 Next 提示：将 searchParams 视为异步并显式 await
  const resolvedSearchParams = await searchParams
  const currentPage = Number.parseInt(resolvedSearchParams.page || "1") || 1
  const searchValue = resolvedSearchParams.search || ""
  const taskTypeValue = resolvedSearchParams.taskType || "ALL"
  const pageLimit = 6 // 每页显示 6 条（3 列栅格整行两行）

  let pagination: { currentPage: number; totalPages: number } | undefined

  if (session.user.role === "PUBLISHER") {
    // 发布者：分页获取发布的任务
    const stats = await getTaskStats({
      publisherId: session.user.id,
      approved: undefined,
      taskType: taskTypeValue as "ALL" | "task" | "annotationTask",
      search: searchValue || undefined,
    })
    const totalPages = Math.max(1, Math.ceil(stats.total / pageLimit))
    pagination = { currentPage, totalPages }
    tasks = await getUnifiedTasks({
      publisherId: session.user.id,
      approved: undefined,
      page: currentPage,
      limit: pageLimit,
      taskType: taskTypeValue as "ALL" | "task" | "annotationTask",
      search: searchValue || undefined,
    })
  } else if (session.user.role === "WORKER") {
    // 接单者：获取认领的普通任务和标注任务
    const [claimedTasks, claimedAnnotationTasks] = await Promise.all([
      // 获取接单者认领的普通任务子任务
      db.subtask.findMany({
        where: {
          workerId: session.user.id,
          ...(searchValue
            ? { task: { title: { contains: searchValue } } }
            : {}),
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
          ...(searchValue
            ? { task: { title: { contains: searchValue } } }
            : {}),
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
        task: { ...subtask.task, taskType: "annotationTask" }
      }))
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, pageLimit) // 接单者仍限制展示最新若干，可后续改为分页
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="仪表盘" text="查看您的任务和统计信息" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UserStats user={user} completedTasksCount={completedTasksCount} />
      </div>

      {session.user.role === "PUBLISHER" ? (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">我发布的任务</h2>
            <div className="flex items-center gap-3">
              <TaskTypeFilter />
              <TaskSearch placeholder="搜索我发布的任务" />
            </div>
          </div>
            <TaskList
              tasks={tasks}
              userRole={session.user.role}
              pagination={pagination}
              query={{
                ...(searchValue ? { search: searchValue } : {}),
                ...(taskTypeValue !== "ALL" ? { taskType: taskTypeValue } : {})
              }}
            />
        </div>
      ) : (
        // 接单者：只显示我认领的任务
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">我认领的任务</h2>
            <TaskSearch placeholder="搜索我认领的任务" />
          </div>
          <TaskList
            tasks={tasks}
            userRole={session.user.role}
            query={searchValue ? { search: searchValue } : undefined}
            showSubmitButton={true}
          />
        </div>
      )}
    </DashboardShell>
  )
}
