"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, Eye } from "lucide-react"
import Link from "next/link"

interface PendingApprovalsProps {
  tasks: any[]
}

export function PendingApprovals({ tasks }: PendingApprovalsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">暂无待审批任务</p>
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

  // Reject task
  const rejectTask = async (taskId: string) => {
    setLoadingId(taskId)
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to reject task")
      }

      toast({
        title: "任务已拒绝",
        description: "任务已被拒绝并删除",
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>任务标题</TableHead>
            <TableHead>发布者</TableHead>
            <TableHead>分类</TableHead>
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
              <TableCell>
                {formatDistanceToNow(new Date(task.createdAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/tasks/${task.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => approveTask(task.id)}
                    disabled={loadingId === task.id}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => rejectTask(task.id)}
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
  )
}
