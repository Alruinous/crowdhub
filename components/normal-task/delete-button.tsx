"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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

interface DeleteButtonProps {
  taskId: string;
}

export function DeleteButton({ taskId }: DeleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/normal-tasks/${taskId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "删除失败");
      }

      toast({
        title: "删除成功",
        description: "日常任务及相关数据已删除",
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 500);
    } catch (error) {
      console.error("删除日常任务失败:", error);
      toast({
        variant: "destructive",
        title: "删除失败",
        description: error instanceof Error ? error.message : "删除任务时发生错误",
      });
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          删除任务
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除任务？</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <span>此操作将永久删除该日常任务及以下所有相关数据：</span>
              <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                <li>任务本身</li>
                <li>所有 AI 拆解的子任务</li>
                <li>所有打分记录</li>
              </ul>
              <div className="text-red-600 font-semibold mt-3">此操作不可撤销，请谨慎操作！</div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "删除中..." : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
