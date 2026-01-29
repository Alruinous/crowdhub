"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RecheckCorrectnessButtonProps {
  taskId: string;
}

export function RecheckCorrectnessButton({ taskId }: RecheckCorrectnessButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/annotation-tasks/${taskId}/recheck-correctness`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "更新失败");
      }

      toast({
        title: "更新成功",
        description: data.checked != null ? `已重新检查 ${data.checked} 条条目` : "任务状态已更新",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "更新失败",
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
      <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "更新中…" : "更新任务状态"}
    </Button>
  );
}
