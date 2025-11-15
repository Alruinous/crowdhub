// 统一的任务查询工具函数

import { db } from "@/lib/db"
import { TaskStatus, AnnotationTaskStatus } from "@prisma/client"
import { TaskQueryParams, UnifiedTask, TaskStats } from "./task-types"

/**
 * 获取统一的任务列表
 */
export async function getUnifiedTasks(params: TaskQueryParams = {}): Promise<UnifiedTask[]> {
  const {
    status = "ALL",
    categoryId = "ALL",
    approved = undefined,  // 默认显示所有任务，包括未审批的
    page = 1,
    limit = 10,
    taskType = "ALL",
    publisherId = undefined,
    search = undefined
  } = params

  const skip = (page - 1) * limit

  // 构建查询条件
  const taskWhere = buildTaskWhere({ status, categoryId, approved, publisherId, search })
  const annotationTaskWhere = buildAnnotationTaskWhere({ status, categoryId, approved, publisherId, search })

  // 并行查询两种任务
  const [tasks, annotationTasks] = await Promise.all([
    // 查询科普任务
    taskType !== "标注任务" ? db.task.findMany({
      where: taskWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        publisher: { select: { name: true } },
        category: true,
        _count: { select: { subtasks: true } },
      },
    }) : [],

    // 查询标注任务
    taskType !== "科普任务" ? db.annotationTask.findMany({
      where: annotationTaskWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        publisher: { select: { name: true } },
        category: true,
        _count: { select: { subtasks: true } },
      },
    }) : []
  ])

  // 合并任务并添加类型标识
  const unifiedTasks: UnifiedTask[] = [
    ...tasks.map(task => ({
      ...task,
      taskType: "科普任务" as const
    })),
    ...annotationTasks.map(task => ({
      ...task,
      taskType: "标注任务" as const
    }))
  ]

  // 按创建时间排序
  return unifiedTasks.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

/**
 * 获取任务统计信息
 */
export async function getTaskStats(params: Omit<TaskQueryParams, 'page' | 'limit'> = {}): Promise<TaskStats> {
  const {
    status = "ALL",
    categoryId = "ALL",
    approved = undefined,  // 默认显示所有任务，包括未审批的
    taskType = "ALL",
    search = undefined
  } = params

  const taskWhere = buildTaskWhere({ status, categoryId, approved, search })
  const annotationTaskWhere = buildAnnotationTaskWhere({ status, categoryId, approved, search })

  const [taskCount, annotationTaskCount] = await Promise.all([
    taskType !== "标注任务" ? db.task.count({ where: taskWhere }) : 0,
    taskType !== "科普任务" ? db.annotationTask.count({ where: annotationTaskWhere }) : 0
  ])

  return {
    total: taskCount + annotationTaskCount,
    taskCount,
    annotationTaskCount
  }
}

/**
 * 构建科普任务查询条件
 */
function buildTaskWhere(params: {
  status: string
  categoryId: string
  approved?: boolean
  publisherId?: string
  search?: string
}) {
  const { status, categoryId, approved, publisherId, search } = params
  const base: any = {
    status: status !== "ALL" ? (status as TaskStatus) : undefined,
    categoryId: categoryId !== "ALL" ? categoryId : undefined,
    approved: approved !== undefined ? approved : undefined,
    publisherId: publisherId !== undefined ? publisherId : undefined,
  }
  if (search && search.trim()) {
    base.title = { contains: search.trim() }
  }
  return base
}

/**
 * 构建标注任务查询条件
 */
function buildAnnotationTaskWhere(params: {
  status: string
  categoryId: string
  approved?: boolean
  publisherId?: string
  search?: string
}) {
  const { status, categoryId, approved, publisherId, search } = params
  const base: any = {
    status: status !== "ALL" ? (status as AnnotationTaskStatus) : undefined,
    categoryId: categoryId !== "ALL" ? categoryId : undefined,
    approved: approved !== undefined ? approved : undefined,
    publisherId: publisherId !== undefined ? publisherId : undefined,
  }
  if (search && search.trim()) {
    base.title = { contains: search.trim() }
  }
  return base
}

/**
 * 根据任务类型生成详情页面链接
 */
export function getTaskDetailLink(task: UnifiedTask): string {
  return task.taskType === "标注任务" 
    ? `/annotation-tasks/${task.id}`
    : `/tasks/${task.id}`
}

/**
 * 获取任务状态显示文本
 */
export function getTaskStatusText(status: string): string {
  const statusMap = {
    "OPEN": "招募中",
    "IN_PROGRESS": "进行中",
    "COMPLETED": "已完成",
    "CLAIMED": "已认领",
    "PENDING_REVIEW": "待审核",
    "REJECTED": "已拒绝"
  }
  
  return statusMap[status as keyof typeof statusMap] || status
}

/**
 * 获取任务状态颜色
 */
export function getTaskStatusColor(status: string): string {
  const colorMap = {
    "OPEN": "bg-green-500",
    "IN_PROGRESS": "bg-blue-500",
    "COMPLETED": "bg-purple-500",
    "CLAIMED": "bg-yellow-500",
    "PENDING_REVIEW": "bg-orange-500",
    "REJECTED": "bg-red-500"
  }
  
  return colorMap[status as keyof typeof colorMap] || "bg-gray-500"
}
