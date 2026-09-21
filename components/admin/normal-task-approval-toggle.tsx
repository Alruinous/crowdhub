"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** 管理员控制“发布者发布的日常任务是否需要审核后才能进入任务广场” */
export function NormalTaskApprovalToggle({ requiresApproval }: { requiresApproval: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentValue, setCurrentValue] = useState(requiresApproval);

  useEffect(() => {
    setCurrentValue(requiresApproval);
  }, [requiresApproval]);

  const setValue = async (value: boolean) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings/normal-task-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresApproval: value }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "保存失败");
      }

      setCurrentValue(value);
      toast({
        title: "设置已保存",
        description: value
          ? "后续发布的日常任务需管理员审核"
          : "后续发布的日常任务将直接进入任务广场",
      });
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>日常任务发布审核</CardTitle>
        <CardDescription>
          控制发布者发布的日常任务，是否需要管理员审核后才能进入任务广场被 worker 认领。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant={currentValue ? "default" : "outline"}
            disabled={loading || currentValue}
            onClick={() => setValue(true)}
            className="gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            需要审核
          </Button>
          <Button
            variant={currentValue ? "outline" : "default"}
            disabled={loading || !currentValue}
            onClick={() => setValue(false)}
            className="gap-2"
          >
            <ShieldOff className="h-4 w-4" />
            无需审核
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">
          当前：
          {currentValue
            ? "需要管理员审核后才能进入任务广场"
            : "发布后直接进入任务广场供 worker 认领（无需审核）"}
          。该设置对之后发布的日常任务生效。
        </p>
      </CardContent>
    </Card>
  );
}
