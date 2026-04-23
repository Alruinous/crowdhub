"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ComputeCorrectnessScoreButtonProps {
  taskId: string;
}

export function ComputeCorrectnessScoreButton({
  taskId,
}: ComputeCorrectnessScoreButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/annotation-tasks/${taskId}/compute-correctness-score`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "计算失败");

      const stats = data?.stats;
      const scanned = typeof stats?.scannedResults === "number" ? stats.scannedResults : null;
      const updated = typeof stats?.updated === "number" ? stats.updated : null;
      const nulled = typeof stats?.nulled === "number" ? stats.nulled : null;

      toast({
        title: "重算完成",
        description:
          stats != null
            ? `已处理 ${scanned ?? 0} 条结果，写入 ${updated ?? 0} 条得分，置空 ${nulled ?? 0} 条（无标准答案）`
            : "已完成重算",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "计算失败",
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
      <Calculator className={`h-4 w-4 mr-1.5 ${loading ? "animate-pulse" : ""}`} />
      {loading ? "重算中…" : "重算正确性得分"}
    </Button>
  );
}

