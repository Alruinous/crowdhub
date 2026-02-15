"use client";

import { Button } from "@/components/ui/button";
import { FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportFinalButtonProps {
  taskId: string;
  taskTitle: string;
}

export function ExportFinalButton({ taskId, taskTitle }: ExportFinalButtonProps) {
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      toast({
        title: "正在导出",
        description: "正在生成最终结果 Excel，请稍候...",
      });

      const response = await fetch(`/api/annotation-tasks/${taskId}/export-final`);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "导出失败");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${taskTitle}_最终结果_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "导出成功",
        description: "最终结果 Excel 已开始下载",
      });
    } catch (error) {
      console.error("导出最终结果失败:", error);
      toast({
        title: "导出失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    }
  };

  return (
    <Button variant="outline" onClick={handleExport}>
      <FileCheck className="h-4 w-4 mr-2" />
      导出最终结果
    </Button>
  );
}
