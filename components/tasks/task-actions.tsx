"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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

interface TaskActionsProps {
  task: any
  isAdmin: boolean
}

export function TaskActions({ task, isAdmin }: TaskActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Approve task (admin only)
  const approveTask = async () => {
    if (!isAdmin) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}/approve`, {
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
      setIsLoading(false)
    }
  }

  // Delete task
  const deleteTask = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete task")
      }

      toast({
        title: "任务已删除",
        description: "任务已成功删除",
      })

      router.push("/tasks")
    } catch (error) {
      toast({
        title: "操作失败",
        description: "删除任务时发生错误",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      {isAdmin && !task.approved && (
        <Button onClick={approveTask} disabled={isLoading}>
          审批任务
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isLoading}>
            删除任务
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除此任务吗？此操作无法撤销，所有相关的子任务和聊天记录都将被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
