import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TaskList } from "@/components/dashboard/task-list"
import { TaskFilters } from "@/components/tasks/task-filters"
import { TaskTypeSelector } from "@/components/tasks/task-type-selector"
import { Category } from "@prisma/client"
import { getUnifiedTasks, getTaskStats } from "@/lib/task-utils"
import { db } from "@/lib/db"

interface TasksPageProps {
  searchParams: Promise<{
    status?: string
    category?: string
    page?: string
    taskType?: string
    search?: string
  }>
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Await searchParams before using them
  const resolvedSearchParams = await searchParams

  // Parse search params
  const statusParam: string = resolvedSearchParams.status || "ALL"
  const categoryParam: string = resolvedSearchParams.category || "ALL"
  const taskTypeParam: string = resolvedSearchParams.taskType || "ALL"
  const searchParam: string = resolvedSearchParams.search || ""
  const page: number = Number.parseInt(resolvedSearchParams.page || "1")
  const limit: number = 10

  // 使用统一的任务工具函数获取任务
  const unifiedTasks = await getUnifiedTasks({
    status: statusParam,
    categoryId: categoryParam,
    approved: true,
    page,
    limit,
    taskType: taskTypeParam as "ALL" | "科普任务" | "标注任务",
    search: searchParam
  })

  // 使用统一的任务工具函数获取统计信息
  const stats = await getTaskStats({
    status: statusParam,
    categoryId: categoryParam,
    approved: true,
    taskType: taskTypeParam as "ALL" | "科普任务" | "标注任务",
    search: searchParam
  })

  const totalPages: number = Math.ceil(stats.total / limit)

  // Get categories for filter
  const categories: Category[] = await db.category.findMany()

  return (
    <DashboardShell>
      <DashboardHeader heading="任务列表" text="浏览所有可用任务">
        {session.user.role === "PUBLISHER" && (
          <TaskTypeSelector />
        )}
      </DashboardHeader>

      <TaskFilters categories={categories} />

      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          共 {stats.total} 个任务
        </div>

        <TaskList
          tasks={unifiedTasks}
          userRole={session.user.role}
          pagination={{
            currentPage: page,
            totalPages,
          }}
        />
      </div>
    </DashboardShell>
  )
}
