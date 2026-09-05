"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";

interface AnnotationCompleteButtonProps {
  taskId: string;
  /** 是否所有认领标注者均已打分 */
  allScored: boolean;
  /** 是否所有认领标注者均已完成全部标注条目 */
  allFinished: boolean;
}

/** 发布者提交整个标注任务完成：需所有标注者完成并全部被打分 */
export function AnnotationCompleteButton({
  taskId,
  allScored,
  allFinished,
}: AnnotationCompleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const canComplete = allScored && allFinished;
  const disabledReason = !allFinished
    ? "还有标注者未完成全部标注"
    : !allScored
      ? "还有标注者未被打分，无法提交"
      : "";

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/annotation-tasks/${taskId}/complete`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "提交失败");
      }
      toast({ title: "提交成功", description: data.message });
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "提交失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      });
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={!canComplete} variant={canComplete ? "default" : "outline"} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          完成任务
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认整个标注任务已完成？</AlertDialogTitle>
          <AlertDialogDescription>
            所有认领标注者均已完成并被打分，提交后该标注任务将被标记为“已完成”。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleComplete} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认完成
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      {disabledReason && (
        <p className="text-xs text-muted-foreground pt-1">{disabledReason}</p>
      )}
    </AlertDialog>
  );
}
