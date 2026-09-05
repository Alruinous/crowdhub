"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** 管理员控制“发布者创建的标注任务是否需要审核后才能进入任务广场” */
export function AnnotationApprovalToggle({ requiresApproval }: { requiresApproval: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const setValue = async (val: boolean) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings/annotation-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresApproval: val }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "保存失败");
      }
      toast({
        title: "设置已保存",
        description: val ? "后续创建的标注任务需审核" : "后续创建的标注任务将直接发布，无需审核",
      });
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      });
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>标注任务发布审核</CardTitle>
        <CardDescription>
          控制发布者创建的数据标注任务，是否需要管理员审核后才能进入任务广场被 worker 认领。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant={requiresApproval ? "default" : "outline"}
            disabled={loading || requiresApproval}
            onClick={() => setValue(true)}
            className="gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            需要审核
          </Button>
          <Button
            variant={requiresApproval ? "outline" : "default"}
            disabled={loading || !requiresApproval}
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
          {requiresApproval
            ? "需要管理员审核后才能进入任务广场"
            : "发布后直接进入任务广场供 worker 认领（无需审核）"}
          。该设置对之后新创建的标注任务生效。
        </p>
      </CardContent>
    </Card>
  );
}
