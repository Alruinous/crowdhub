"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, Eye, FileText, Database, Search } from "lucide-react"
import Link from "next/link"
import { UnifiedTask, TASK_TYPE_MAP } from "@/lib/task-types"

interface PendingApprovalsProps {
  tasks: UnifiedTask[]
  pagination?: {
    currentPage: number
    totalPages: number
  }
  query?: Record<string, string>
}

export function PendingApprovals({ tasks, pagination, query }: PendingApprovalsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(query?.search || "")
  const [publisherInput, setPublisherInput] = useState(query?.publisher || "")
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Handle filter change
  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value && value !== "ALL") {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    // Reset to page 1 when filter changes
    params.delete("page")
    
    router.push(`?${params.toString()}`)
  }

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleFilterChange("search", searchInput)
  }

  // Handle publisher search submit
  const handlePublisherSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleFilterChange("publisher", publisherInput)
  }

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(tasks.map(task => task.id)))
    }
  }

  // Toggle single task selection
  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  // Approve task
  const approveTask = async (task: UnifiedTask) => {
    setLoadingId(task.id)
    try {
      const apiUrl = task.taskType === "annotationTask" 
        ? `/api/annotation-tasks/${task.id}/approve`
        : `/api/tasks/${task.id}/approve`

      const response = await fetch(apiUrl, {
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Failed to approve task")
      }

      toast({
        title: "任务已审批",
        description: `${task.taskType}已成功审批并发布`,
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "审批任务时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  // Reject task
  const rejectTask = async (task: UnifiedTask) => {
    setLoadingId(task.id)
    try {
      const apiUrl = task.taskType === "annotationTask" 
        ? `/api/annotation-tasks/${task.id}`
        : `/api/tasks/${task.id}`

      const response = await fetch(apiUrl, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to reject task")
      }

      toast({
        title: "任务已拒绝",
        description: `${task.taskType}已被拒绝并删除`,
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "拒绝任务时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  // Batch approve tasks
  const batchApprove = async () => {
    if (selectedTasks.size === 0) {
      toast({
        title: "请选择任务",
        description: "请至少选择一个任务进行批量审批",
        variant: "destructive",
      })
      return
    }

    setIsBatchLoading(true)
    const selectedTaskList = tasks.filter(task => selectedTasks.has(task.id))
    let successCount = 0
    let failCount = 0

    try {
      for (const task of selectedTaskList) {
        try {
          const apiUrl = task.taskType === "annotationTask" 
            ? `/api/annotation-tasks/${task.id}/approve`
            : `/api/tasks/${task.id}/approve`

          const response = await fetch(apiUrl, {
            method: "PATCH",
          })

          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
        }
      }

      toast({
        title: "批量审批完成",
        description: `成功: ${successCount} 个，失败: ${failCount} 个`,
        variant: successCount > 0 ? "default" : "destructive",
      })

      setSelectedTasks(new Set())
      router.refresh()
    } finally {
      setIsBatchLoading(false)
    }
  }

  // Batch reject tasks
  const batchReject = async () => {
    if (selectedTasks.size === 0) {
      toast({
        title: "请选择任务",
        description: "请至少选择一个任务进行批量拒绝",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`确定要拒绝并删除 ${selectedTasks.size} 个任务及其所有相关数据吗？此操作不可恢复！`)) {
      return
    }

    setIsBatchLoading(true)
    const selectedTaskList = tasks.filter(task => selectedTasks.has(task.id))
    let successCount = 0
    let failCount = 0

    try {
      for (const task of selectedTaskList) {
        try {
          const apiUrl = task.taskType === "annotationTask" 
            ? `/api/annotation-tasks/${task.id}`
            : `/api/tasks/${task.id}`

          const response = await fetch(apiUrl, {
            method: "DELETE",
          })

          if (response.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
        }
      }

      toast({
        title: "批量拒绝完成",
        description: `成功: ${successCount} 个，失败: ${failCount} 个`,
        variant: successCount > 0 ? "default" : "destructive",
      })

      setSelectedTasks(new Set())
      router.refresh()
    } finally {
      setIsBatchLoading(false)
    }
  }

  // Get task type icon
  const getTaskTypeIcon = (taskType: string) => {
    return taskType === "annotationTask" ? <Database className="h-4 w-4" /> : <FileText className="h-4 w-4" />
  }

  // Get task type badge color
  const getTaskTypeColor = (taskType: string) => {
    return taskType === "annotationTask" 
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-blue-100 text-blue-800 border-blue-200"
  }

  // Get task detail link
  const getTaskDetailLink = (task: UnifiedTask) => {
    return task.taskType === "annotationTask" 
      ? `/annotation-tasks/${task.id}`
      : `/tasks/${task.id}`
  }

  return (
    <div className="space-y-4">
      {/* 过滤器 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        {/* 任务类型过滤 */}
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">任务类型</label>
          <Select
            value={query?.taskType || "ALL"}
            onValueChange={(value) => handleFilterChange("taskType", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择任务类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部类型</SelectItem>
              <SelectItem value="task">科普任务</SelectItem>
              <SelectItem value="annotationTask">标注任务</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 发布者搜索 */}
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">搜索发布者</label>
          <form onSubmit={handlePublisherSearchSubmit} className="flex gap-2">
            <Input
              placeholder="输入发布者名称..."
              value={publisherInput}
              onChange={(e) => setPublisherInput(e.target.value)}
            />
            <Button type="submit" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* 标题搜索 */}
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">搜索标题</label>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <Input
              placeholder="输入任务标题..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Button type="submit" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* 批量操作按钮 */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              已选择 <span className="font-semibold text-foreground">{selectedTasks.size}</span> / {tasks.length} 个任务
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              disabled={isBatchLoading}
            >
              {selectedTasks.size === tasks.length ? "取消全选" : "全选"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={batchApprove}
              disabled={selectedTasks.size === 0 || isBatchLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              批量同意
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={batchReject}
              disabled={selectedTasks.size === 0 || isBatchLoading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              批量拒绝
            </Button>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-md">
          <p className="text-muted-foreground">暂无待审批任务</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={selectedTasks.size === tasks.length && tasks.length > 0}
                onChange={toggleSelectAll}
                className="cursor-pointer"
              />
            </TableHead>
            <TableHead>任务类型</TableHead>
            <TableHead>任务标题</TableHead>
            <TableHead>发布者</TableHead>
            <TableHead>发布时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedTasks.has(task.id)}
                  onChange={() => toggleTaskSelection(task.id)}
                  className="cursor-pointer"
                />
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getTaskTypeColor(task.taskType)}>
                  <span className="flex items-center gap-1">
                    {getTaskTypeIcon(task.taskType)}
                    {TASK_TYPE_MAP[task.taskType as keyof typeof TASK_TYPE_MAP]?.label || task.taskType}
                  </span>
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>{task.publisher.name}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(task.createdAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={getTaskDetailLink(task)}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => approveTask(task)}
                    disabled={loadingId === task.id}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => rejectTask(task)}
                    disabled={loadingId === task.id}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
        </div>
      )}

      {/* 分页器 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
            (page) => (
              <Button
                key={page}
                variant={
                  page === pagination.currentPage ? "default" : "outline"
                }
                size="sm"
                asChild
              >
                <Link
                  href={{
                    query: { ...(query || {}), page },
                  }}
                >
                  {page}
                </Link>
              </Button>
            )
          )}
        </div>
      )}
    </div>
  )
}
