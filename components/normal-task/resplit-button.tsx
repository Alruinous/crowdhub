"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function ResplitButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleResplit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/normal-tasks/${taskId}/resplit`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "重新拆分失败");
      }
      toast({ title: "拆分成功", description: data.message });
      router.refresh();
    } catch (error) {
      toast({
        title: "重新拆分失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleResplit} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {loading ? "拆解中..." : "重新拆分子任务"}
    </Button>
  );
}
