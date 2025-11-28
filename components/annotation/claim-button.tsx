"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
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

interface ClaimButtonProps {
  subtaskId: string
  taskId: string
}

export function ClaimButton({ subtaskId, taskId }: ClaimButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleClaim = async () => {
    setIsLoading(true)
    try {
      console.log("开始认领子任务:", subtaskId)
      
      const response = await fetch(`/api/annotation-subtasks/${subtaskId}/claim`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("API响应状态:", response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log("认领成功，准备跳转:", result)
        
        toast({
          title: "认领成功",
          description: "您已成功认领此标注子任务",
        })
        
        // 使用setTimeout确保路由跳转在下一个事件循环中执行
        setTimeout(() => {
          console.log("执行路由跳转到仪表盘")
          router.push("/dashboard")
        }, 100)
      } else {
        const errorData = await response.json()
        console.log("认领失败:", errorData)
        toast({
          title: "认领失败",
          description: errorData.message || "认领失败，请稍后再试",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("认领过程中发生错误:", error)
      toast({
        title: "认领失败",
        description: "网络错误，请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={isLoading}>
          {isLoading ? "认领中..." : "认领"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认认领</AlertDialogTitle>
          <AlertDialogDescription>
            认领后该子任务将归属您，可以在仪表盘中找到它。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false)
              handleClaim()
            }}
          >
            确认认领
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
