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

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
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

  // 兼容 Next 提示：将 searchParams 视为异步并显式 await
  const resolvedSearchParams = await searchParams
  const currentPage = Number.parseInt(resolvedSearchParams.page || "1") || 1
  const searchValue = resolvedSearchParams.search || ""
  const pageLimit = 6 // 每页显示 6 条（3 列栅格整行两行）

  let pagination: { currentPage: number; totalPages: number } | undefined

  if (session.user.role === "PUBLISHER") {
    // 发布者：分页获取发布的任务
    const stats = await getTaskStats({
      publisherId: session.user.id,
      approved: undefined,
      taskType: "ALL",
      search: searchValue || undefined,
    })
    const totalPages = Math.max(1, Math.ceil(stats.total / pageLimit))
    pagination = { currentPage, totalPages }
    tasks = await getUnifiedTasks({
      publisherId: session.user.id,
      approved: undefined,
      page: currentPage,
      limit: pageLimit,
      taskType: "ALL",
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
        task: { ...subtask.task, taskType: "标注任务" }
      }))
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, pageLimit) // 工作者仍限制展示最新若干，可后续改为分页
  }

  return (
    <DashboardShell>
      <DashboardHeader heading="仪表盘" text="查看您的任务和统计信息" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UserStats user={user} />
      </div>

      {session.user.role === "PUBLISHER" ? (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">我发布的任务</h2>
            <TaskSearch placeholder="搜索我发布的任务" />
          </div>
            <TaskList
              tasks={tasks}
              userRole={session.user.role}
              pagination={pagination}
              query={searchValue ? { search: searchValue } : undefined}
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
          />
        </div>
      )}
    </DashboardShell>
  )
}
