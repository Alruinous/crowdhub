"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ExportButtonProps {
  taskId: string
  taskTitle: string
}

export function ExportButton({ taskId, taskTitle }: ExportButtonProps) {
  const { toast } = useToast()

  const handleExport = async () => {
    try {
      // 显示加载提示
      toast({
        title: "正在导出",
        description: "正在生成Excel文件，请稍候...",
      })

      // 调用导出API
      const response = await fetch(`/api/annotation-tasks/${taskId}/export`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "导出失败")
      }

      // 获取Blob数据
      const blob = await response.blob()
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${taskTitle}_标注结果_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // 显示成功提示
      toast({
        title: "导出成功",
        description: "Excel文件已开始下载",
      })
    } catch (error) {
      console.error("导出失败:", error)
      toast({
        title: "导出失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive"
      })
    }
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />
      导出Excel
    </Button>
  )
}
