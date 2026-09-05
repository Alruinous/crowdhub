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

interface CompleteButtonProps {
  taskId: string;
  /** 是否所有子任务均已提交完成 */
  allCompleted: boolean;
  /** 尚未完成的子任务数 */
  remaining: number;
}

/** 发布者提交整个任务完成：需所有子任务均完成后才可点击 */
export function CompleteButton({ taskId, allCompleted, remaining }: CompleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/normal-tasks/${taskId}/complete`, {
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
    <div className="flex flex-wrap items-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={!allCompleted} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            完成任务
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认整个任务已完成？</AlertDialogTitle>
            <AlertDialogDescription>
              所有子任务均已提交完成，提交后该日常任务将被标记为“已完成”，无法再认领或修改。
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
      </AlertDialog>

      {!allCompleted && (
        <span className="text-xs text-muted-foreground">
          还有 {remaining} 个子任务未完成，全部完成后方可提交
        </span>
      )}
    </div>
  );
}
