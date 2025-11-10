"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"

interface SubtaskListProps {
  subtasks: any[]
  taskId: string
  publisherId: string
  userId: string
  userRole: string
}

export function SubtaskList({ subtasks, taskId, publisherId, userId, userRole }: SubtaskListProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  if (subtasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">暂无子任务</p>
      </div>
    )
  }

  // Claim a subtask
  const claimSubtask = async (subtaskId: string) => {
    setIsLoading(subtaskId)
    try {
      const response = await fetch(`/api/subtasks/${subtaskId}/claim`, {
        method: "PATCH",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to claim subtask")
      }

      toast({
        title: "认领成功",
        description: "您已成功认领此子任务",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "操作失败",
        description: error.message || "认领子任务时发生错误",
        variant: "destructive",
      })
    } finally {
      setIsLoading(null)
    }
  }

  // Mark subtask as completed
  const completeSubtask = async (subtaskId: string) => {
    setIsLoading(subtaskId)
    try {
      const response = await fetch(`/api/subtasks/${subtaskId}/complete`, {
        method: "PATCH",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to complete subtask")
      }

      toast({
        title: "标记完成",
        description: "子任务已标记为完成，等待发布者确认",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "操作失败",
        description: error.message || "标记完成时发生错误",
        variant: "destructive",
      })
    } finally {
      setIsLoading(null)
    }
  }

  // Approve completed subtask (publisher only)
  const approveSubtask = async (subtaskId: string) => {
    setIsLoading(subtaskId)
    try {
      const response = await fetch(`/api/subtasks/${subtaskId}/approve`, {
        method: "PATCH",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to approve subtask")
      }

      toast({
        title: "确认完成",
        description: "子任务已确认完成",
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: "操作失败",
        description: error.message || "确认完成时发生错误",
        variant: "destructive",
      })
    } finally {
      setIsLoading(null)
    }
  }

  // Helper function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-green-500"
      case "IN_PROGRESS":
        return "bg-blue-500"
      case "PENDING_APPROVAL":
        return "bg-yellow-500"
      case "COMPLETED":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="grid gap-4">
      {subtasks.map((subtask) => {
        const isPublisher = publisherId === userId
        const isWorker = subtask.workerId === userId
        const isOpen = subtask.status === "OPEN"
        const isInProgress = subtask.status === "IN_PROGRESS"
        const isPendingApproval = subtask.status === "PENDING_APPROVAL"
        const isCompleted = subtask.status === "COMPLETED"

        return (
          <Card key={subtask.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{subtask.title}</CardTitle>
                <Badge className={getStatusColor(subtask.status)}>
                  {subtask.status === "OPEN"
                    ? "待认领"
                    : subtask.status === "IN_PROGRESS"
                      ? "进行中"
                      : subtask.status === "PENDING_APPROVAL"
                        ? "待确认"
                        : subtask.status === "COMPLETED"
                          ? "已完成"
                          : subtask.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="text-sm whitespace-pre-line">{subtask.description}</div>
                <div className="text-sm">
                  <span className="font-medium">积分：</span>
                  {subtask.points}
                </div>
                {subtask.workerId && (
                  <div className="text-sm">
                    <span className="font-medium">接单者：</span>
                    {subtask.worker.name}
                  </div>
                )}
                {subtask.completedAt && (
                  <div className="text-sm">
                    <span className="font-medium">完成时间：</span>
                    {formatDistanceToNow(new Date(subtask.completedAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex gap-2">
                {/* Worker can claim open subtasks */}
                {userRole === "WORKER" && isOpen && !isWorker && (
                  <Button onClick={() => claimSubtask(subtask.id)} disabled={isLoading === subtask.id}>
                    认领任务
                  </Button>
                )}

                {/* Worker can mark their in-progress subtasks as completed */}
                {isWorker && isInProgress && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={isLoading === subtask.id}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        标记完成
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认完成</AlertDialogTitle>
                        <AlertDialogDescription>
                          您确定已完成此子任务吗？标记完成后，将等待发布者确认。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => completeSubtask(subtask.id)}>确认完成</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Publisher can approve pending subtasks */}
                {isPublisher && isPendingApproval && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isLoading === subtask.id}>确认完成</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认完成</AlertDialogTitle>
                        <AlertDialogDescription>
                          您确定要确认此子任务已完成吗？确认后将支付积分给接单者。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => approveSubtask(subtask.id)}>确认完成</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
