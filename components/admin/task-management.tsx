"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { MoreHorizontal, CheckCircle, Trash, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface TaskManagementProps {
  tasks: any[]
  pagination: {
    currentPage: number
    totalPages: number
  }
}

export function TaskManagement({ tasks, pagination }: TaskManagementProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">暂无任务</p>
      </div>
    )
  }

  // Approve task
  const approveTask = async (taskId: string) => {
    setLoadingId(taskId)
    try {
      const response = await fetch(`/api/tasks/${taskId}/approve`, {
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Failed to approve task")
      }

      toast({
        title: "任务已审批",
        description: "任务已成功审批并发布",
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

  // Delete task
  const deleteTask = async (taskId: string) => {
    setLoadingId(taskId)
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete task")
      }

      toast({
        title: "任务已删除",
        description: "任务已成功删除",
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "删除任务时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge className="bg-green-500">招募中</Badge>
      case "IN_PROGRESS":
        return <Badge className="bg-blue-500">进行中</Badge>
      case "COMPLETED":
        return <Badge className="bg-purple-500">已完成</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>任务标题</TableHead>
            <TableHead>发布者</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>审批状态</TableHead>
            <TableHead>发布时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>{task.publisher.name}</TableCell>
              <TableCell>{task.category.name}</TableCell>
              <TableCell>{getStatusBadge(task.status)}</TableCell>
              <TableCell>
                {task.approved ? (
                  <Badge className="bg-green-500">已审批</Badge>
                ) : (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    待审批
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(task.createdAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>操作</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/tasks/${task.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        查看详情
                      </Link>
                    </DropdownMenuItem>
                    {!task.approved && (
                      <DropdownMenuItem onClick={() => approveTask(task.id)} disabled={loadingId === task.id}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        审批任务
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => deleteTask(task.id)} disabled={loadingId === task.id}>
                      <Trash className="mr-2 h-4 w-4" />
                      删除任务
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 p-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
            <Button key={page} variant={page === pagination.currentPage ? "default" : "outline"} size="sm" asChild>
              <Link
                href={{
                  query: { page },
                }}
              >
                {page}
              </Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
