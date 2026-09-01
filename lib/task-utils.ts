// 统一的任务查询工具函数

import { db } from "@/lib/db"
import { TaskStatus, AnnotationTaskStatus, NormalTaskStatus } from "@prisma/client"
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
    publisher = undefined,
    search = undefined
  } = params

  const skip = (page - 1) * limit

  // 构建查询条件
  const taskWhere = buildTaskWhere({ status, categoryId, approved, publisherId, publisher, search })
  const annotationTaskWhere = buildAnnotationTaskWhere({ status, categoryId, approved, publisherId, publisher, search })
  const normalTaskWhere = buildNormalTaskWhere({ status, publisherId, publisher, search })

  // 并行查询两种任务
  // 当请求类型为 ALL 时，需要“跨两张表的统一分页”逻辑：
  // 不能分别 skip/take 后再合并，否则会出现两边独立分页、合并后总数不足的问题。
  // 方案：各自查询前 (page * limit) 条，合并排序后再在内存里 slice 需要的区间。
  const [tasks, annotationTasks, normalTasks] = await Promise.all([
    taskType !== "annotationTask"
      ? db.task.findMany({
          where: taskWhere,
          orderBy: { createdAt: "desc" },
          // 如果只查task仍使用数据库分页；如果是 ALL 则取前 page*limit 条
          skip: taskType === "ALL" ? 0 : skip,
          take: taskType === "ALL" ? page * limit : limit,
          include: {
            publisher: { select: { id: true, name: true } },
            category: true,
            _count: { select: { subtasks: true } },
          },
        })
      : [],
    taskType !== "task"
      ? db.annotationTask.findMany({
          where: annotationTaskWhere,
          orderBy: { createdAt: "desc" },
          skip: taskType === "ALL" ? 0 : skip,
          take: taskType === "ALL" ? page * limit : limit,
          include: {
            publisher: { select: { id: true, name: true } },
            _count: { select: { annotations: true } },
          },
        })
      : [],
    taskType !== "task" && taskType !== "annotationTask" && approved !== false
      ? db.normalTask.findMany({
          where: normalTaskWhere,
          orderBy: { createdAt: "desc" },
          skip: taskType === "ALL" ? 0 : skip,
          take: taskType === "ALL" ? page * limit : limit,
          include: {
            publisher: { select: { id: true, name: true } },
            _count: { select: { subtasks: true } },
          },
        })
      : [],
  ])

  // 合并并标记类型
  let unifiedTasks: UnifiedTask[] = [
    ...tasks.map((task) => ({ ...task, taskType: "task" as const })),
    ...annotationTasks.map((task) => ({ ...task, taskType: "annotationTask" as const })),
    ...normalTasks.map((task) => ({ ...task, taskType: "normalTask" as const })),
  ]

  unifiedTasks = unifiedTasks.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  // 如果是 ALL，需要在合并后做统一分页截取
  if (taskType === "ALL") {
    unifiedTasks = unifiedTasks.slice(skip, skip + limit)
  }

  return unifiedTasks
}

/**
 * 获取任务统计信息
 */
export async function getTaskStats(params: Omit<TaskQueryParams, 'page' | 'limit'> = {}): Promise<TaskStats> {
  const {
    status = "ALL",
    categoryId = "ALL",
    approved = undefined,
    taskType = "ALL", 
    search = undefined,
    publisherId = undefined,
    publisher = undefined
  } = params

  const taskWhere = buildTaskWhere({ status, categoryId, approved, publisherId, publisher, search })
  const annotationTaskWhere = buildAnnotationTaskWhere({ status, categoryId, approved, publisherId, publisher, search })
  const normalTaskWhere = buildNormalTaskWhere({ status, publisherId, publisher, search })

  const [taskCount, annotationTaskCount, normalTaskCount] = await Promise.all([
    taskType !== "annotationTask" && taskType !== "normalTask" ? db.task.count({ where: taskWhere }) : 0,
    taskType !== "task" && taskType !== "normalTask" ? db.annotationTask.count({ where: annotationTaskWhere }) : 0,
    taskType !== "task" && taskType !== "annotationTask" && approved !== false ? db.normalTask.count({ where: normalTaskWhere }) : 0
  ])

  return {
    total: taskCount + annotationTaskCount + normalTaskCount,
    taskCount,
    annotationTaskCount,
    normalTaskCount
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
  publisher?: string
  search?: string
}) {
  const { status, categoryId, approved, publisherId, publisher, search } = params
  const base: any = {
    status: status !== "ALL" ? (status as TaskStatus) : undefined,
    categoryId: categoryId !== "ALL" ? categoryId : undefined,
    approved: approved !== undefined ? approved : undefined,
    publisherId: publisherId !== undefined ? publisherId : undefined,
  }
  if (search && search.trim()) {
    base.title = { contains: search.trim() }
  }
  if (publisher && publisher.trim()) {
    base.publisher = {
      name: { contains: publisher.trim() }
    }
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
  publisher?: string
  search?: string
}) {
  const { status, approved, publisherId, publisher, search } = params
  const base: any = {
    status: status !== "ALL" ? (status as AnnotationTaskStatus) : undefined,
    approved: approved !== undefined ? approved : undefined,
    publisherId: publisherId !== undefined ? publisherId : undefined,
  }
  if (search && search.trim()) {
    base.title = { contains: search.trim() }
  }
  if (publisher && publisher.trim()) {
    base.publisher = {
      name: { contains: publisher.trim() }
    }
  }
  return base
}

/**
 * 构建日常任务查询条件
 * 说明：列表页请求 OPEN（可认领）时，日常任务对应"已发布"（IN_PROGRESS，子任务开放认领），
 * 因此将 OPEN 映射为 IN_PROGRESS。
 */
function buildNormalTaskWhere(params: {
  status: string
  publisherId?: string
  publisher?: string
  search?: string
}) {
  const { status, publisherId, publisher, search } = params
  const base: any = {
    status:
      status === "ALL"
        ? undefined
        : (status === "OPEN" ? "IN_PROGRESS" as NormalTaskStatus : status),
    publisherId: publisherId !== undefined ? publisherId : undefined,
  }
  // 任务广场（未指定发布者）时，仅展示仍开放认领（存在可认领子任务）的日常任务；
  // 发布者仪表盘（指定 publisherId）需要展示自己发布的所有日常任务，因此不过滤。
  if (publisherId === undefined) {
    base.subtasks = { some: { status: "OPEN" } }
  }
  if (search && search.trim()) {
    base.title = { contains: search.trim() }
  }
  if (publisher && publisher.trim()) {
    base.publisher = {
      name: { contains: publisher.trim() }
    }
  }
  return base
}

/**
 * 根据任务类型生成详情页面链接
 */
export function getTaskDetailLink(task: UnifiedTask): string {
  switch (task.taskType) {
    case "annotationTask":
      return `/annotation-tasks/${task.id}`
    case "normalTask":
      return `/normal-tasks/${task.id}`
    default:
      return `/tasks/${task.id}`
  }
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
