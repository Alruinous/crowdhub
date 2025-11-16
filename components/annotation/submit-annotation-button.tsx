"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"
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
} from "@/components/ui/alert-dialog"

interface SubmitAnnotationButtonProps {
  taskId: string
}

export function SubmitAnnotationButton({
  taskId,
}: SubmitAnnotationButtonProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleSubmit = async () => {
    setIsChecking(true)
    try {
      // 检查标注完成度
      const checkRes = await fetch(
        `/api/annotation-tasks/${taskId}/check-completion`
      )
      const checkData = await checkRes.json()

      if (!checkRes.ok) {
        throw new Error(checkData.message || "检查失败")
      }

      if (!checkData.isComplete) {
        // 有未完成的标注
        toast({
          title: "无法提交",
          description: checkData.message || "存在未完成的标注数据",
          variant: "destructive",
        })
        return
      }

      // 所有标注完成，显示确认对话框
      setShowConfirmDialog(true)
    } catch (error) {
      toast({
        title: "检查失败",
        description: error instanceof Error ? error.message : "无法检查标注完成度",
        variant: "destructive",
      })
    } finally {
      setIsChecking(false)
    }
  }

  const confirmSubmit = async () => {
    setShowConfirmDialog(false)
    setIsSubmitting(true)
    try {
      // 提交标注
      const submitRes = await fetch(`/api/annotation-tasks/${taskId}/submit`, {
        method: "POST",
      })
      const submitData = await submitRes.json()

      if (!submitRes.ok) {
        throw new Error(submitData.message || "提交失败")
      }

      toast({
        title: "提交成功",
        description: "标注任务已提交，等待审核",
      })

      // 刷新页面以更新状态
      router.refresh()
    } catch (error) {
      toast({
        title: "提交失败",
        description: error instanceof Error ? error.message : "无法提交标注任务",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={handleSubmit}
        disabled={isChecking || isSubmitting}
      >
        {isChecking || isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isChecking ? "检查中..." : "提交中..."}
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            提交
          </>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认提交</AlertDialogTitle>
            <AlertDialogDescription>
              所有数据条目均已完成标注，确认提交吗？提交后状态将变为"待审核"，但您仍可继续修改标注。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit}>确认提交</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
