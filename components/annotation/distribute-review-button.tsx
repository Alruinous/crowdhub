"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DistributeReviewButtonProps {
  taskId: string;
}

export function DistributeReviewButton({ taskId }: DistributeReviewButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/annotation-tasks/${taskId}/distribute-review`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "下发失败");
      }

      toast({
        title: "下发成功",
        description:
          data.distributed != null && data.distributed > 0
            ? `已下发 ${data.distributed} 条需复审条目给一级复审员`
            : data.message || "暂无待下发的需复审条目",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "下发失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      <Send className={`h-4 w-4 mr-1.5 ${loading ? "animate-pulse" : ""}`} />
      {loading ? "下发中…" : "下发复审任务"}
    </Button>
  );
}
