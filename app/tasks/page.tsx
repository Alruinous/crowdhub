import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TaskList } from "@/components/dashboard/task-list"
import { db } from "@/lib/db"
import { TaskFilters } from "@/components/tasks/task-filters"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PlusCircle } from "lucide-react"
import { Category, Task, Prisma, TaskStatus } from "@prisma/client"
import { Session } from "next-auth"

// 定义带关联数据的Task类型
type TaskWithRelations = Task & {
  publisher: {
    name: string
  }
  category: Category
  _count: {
    subtasks: number
  }
}

export default async function TasksPage({ searchParams }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // 先解析searchParams
  const parsedSearchParams = await Promise.resolve(searchParams) as any;

  // Parse search params
  const statusParam: string = (parsedSearchParams.status as string) || "ALL"
  const categoryParam: string = (parsedSearchParams.category as string) || "ALL"
  const page: number = Number.parseInt((parsedSearchParams.page as string) || "1")
  const limit: number = 10
  const skip: number = (page - 1) * limit

  // Build filter conditions
  const where: Prisma.TaskWhereInput = {
    status: statusParam !== "ALL" ? statusParam as TaskStatus : undefined,
    categoryId: categoryParam !== "ALL" ? categoryParam : undefined,
    approved: true, // Only show approved tasks
  }

  // Get tasks
  const tasks: TaskWithRelations[] = await db.task.findMany({
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
  const totalTasks: number = await db.task.count({ where })
  const totalPages: number = Math.ceil(totalTasks / limit)

  // Get categories for filter
  const categories: Category[] = await db.category.findMany()

  return (
    <DashboardShell>
      <DashboardHeader heading="任务列表" text="浏览所有可用任务">
        {session.user.role === "PUBLISHER" && (
          <Button asChild>
            <Link href="/tasks/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              发布任务
            </Link>
          </Button>
        )}
      </DashboardHeader>

      <TaskFilters categories={categories} />

      <TaskList
        tasks={tasks}
        userRole={session.user.role}
        pagination={{
          currentPage: page,
          totalPages,
        }}
      />
    </DashboardShell>
  )
}