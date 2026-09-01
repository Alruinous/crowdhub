"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function PublishButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/normal-tasks/${taskId}/publish`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "发布失败");
      }
      toast({ title: "发布成功", description: data.message });
      router.refresh();
    } catch (error) {
      toast({
        title: "发布失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handlePublish} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
      发布任务
    </Button>
  );
}
