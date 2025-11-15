// 统一的任务类型定义

import { Task, AnnotationTask, Category, TaskStatus, AnnotationTaskStatus } from "@prisma/client"

// 基础任务接口 - 定义两种任务共有的属性
export interface BaseTask {
  id: string
  title: string
  description?: string | null
  status: string
  points: number
  maxWorkers: number
  approved: boolean
  createdAt: Date
  updatedAt: Date
  completedAt?: Date | null
  publisher: { name: string }
  category?: { name: string } | null
  _count?: { subtasks: number }
  taskType: "科普任务" | "标注任务"
}

// 统一的任务类型
export type UnifiedTask = BaseTask

// 任务查询参数
export interface TaskQueryParams {
  status?: string
  categoryId?: string
  approved?: boolean
  page?: number
  limit?: number
  taskType?: "ALL" | "科普任务" | "标注任务"
  publisherId?: string
  search?: string // 新增：标题模糊搜索
}

// 任务统计信息
export interface TaskStats {
  total: number
  taskCount: number
  annotationTaskCount: number
}

// 任务状态映射
export const TASK_STATUS_MAP = {
  "OPEN": "招募中",
  "IN_PROGRESS": "进行中", 
  "COMPLETED": "已完成"
} as const

// 任务类型映射
export const TASK_TYPE_MAP = {
  "科普任务": {
    label: "科普任务",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "FileText"
  },
  "标注任务": {
    label: "标注任务", 
    color: "bg-green-100 text-green-800 border-green-200",
    icon: "Database"
  }
} as const
