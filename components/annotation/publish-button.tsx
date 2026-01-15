"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
} from "@/components/ui/alert-dialog";

interface PublishButtonProps {
  taskId: string;
  taskStatus: string;
  isPublisher: boolean;
}

export function PublishButton({ taskId, taskStatus, isPublisher }: PublishButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // 只有发布者可以看到
  if (!isPublisher) {
    return null;
  }

  // OPEN或IN_PROGRESS状态都显示按钮
  if (taskStatus !== "OPEN" && taskStatus !== "IN_PROGRESS") {
    return null;
  }

  // 判断是否已发布
  const isPublished = taskStatus === "IN_PROGRESS";

  const handlePublish = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/annotation-tasks/${taskId}/publish`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "发布失败");
      }
      
      toast({
        title: "发布成功",
        description: "任务已发布，其他用户将无法继续认领",
      });

      // 刷新页面以更新状态
      router.refresh();
    } catch (error) {
      toast({
        title: "发布失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant={isPublished ? "secondary" : "default"} 
          size="default" 
          className="gap-2"
          disabled={isPublished}
        >
          <Send className="h-4 w-4" />
          {isPublished ? "已发布" : "发布任务"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认发布任务？</AlertDialogTitle>
          <AlertDialogDescription>
            发布后，任务状态将变为"进行中"，其他用户将无法继续认领此任务。已认领的用户可以开始标注。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handlePublish} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                发布中...
              </>
            ) : (
              "确认发布"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
