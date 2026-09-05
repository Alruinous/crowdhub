"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STATUS_MAP: Record<string, { text: string; cls: string }> = {
  OPEN: { text: "可认领", cls: "bg-green-100 text-green-800 border-green-200" },
  IN_PROGRESS: { text: "进行中", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  PENDING_REVIEW: { text: "待确认", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  COMPLETED: { text: "已确认", cls: "bg-purple-100 text-purple-800 border-purple-200" },
};

/** 子任务状态徽章（显示在子任务标题旁） */
export function SubtaskStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { text: status, cls: "bg-gray-100 text-gray-800" };
  return <Badge variant="outline" className={`${s.cls} w-16 justify-center`}>{s.text}</Badge>;
}

interface SubtaskActionsProps {
  taskId: string;
  subtaskId: string;
  /** 子任务当前状态 */
  status: string;
  /** 是否已由当前用户认领 */
  isClaimedByMe: boolean;
  isWorker: boolean;
  /** 认领人姓名 */
  workerName?: string;
}

export function SubtaskActions({ taskId, subtaskId, status, isClaimedByMe, isWorker, workerName }: SubtaskActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitContent, setSubmitContent] = useState("");

  const doRequest = async (action: "claim" | "submit", content?: string) => {
    setLoading(true);
    try {
      const isSubmit = action === "submit";
      const response = await fetch(`/api/normal-tasks/${taskId}/subtasks/${subtaskId}/${action}`, {
        method: "POST",
        ...(isSubmit
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }
          : {}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "操作失败");
      }
      toast({
        title: isSubmit ? "提交成功" : "认领成功",
        description: data.message,
      });
      if (isSubmit) {
        setShowSubmitDialog(false);
        setSubmitContent("");
      }
      router.refresh();
    } catch (error) {
      toast({
        title: action === "claim" ? "认领失败" : "提交失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isWorker && status === "OPEN" && (
        <Button size="sm" onClick={() => doRequest("claim")} disabled={loading} className="gap-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          认领
        </Button>
      )}
      {isWorker && isClaimedByMe && status === "IN_PROGRESS" && (
        <Button size="sm" onClick={() => setShowSubmitDialog(true)} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="h-4 w-4" />
          提交
        </Button>
      )}
      {isWorker && isClaimedByMe && status === "PENDING_REVIEW" && (
        <Button size="sm" variant="secondary" disabled className="gap-1 cursor-not-allowed">
          <CheckCircle2 className="h-4 w-4" />
          已提交
        </Button>
      )}

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>提交子任务内容</DialogTitle>
            <DialogDescription>请填写该子任务的完成情况（当前支持文字）</DialogDescription>
            {workerName && (
              <p className="text-sm text-muted-foreground pt-1">认领人：{workerName}</p>
            )}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="submit-content">提交内容</Label>
            <Textarea
              id="submit-content"
              rows={8}
              value={submitContent}
              onChange={(e) => setSubmitContent(e.target.value)}
              placeholder="在此填写提交的文字内容..."
              className="text-base"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={loading}>
              取消
            </Button>
            <Button onClick={() => doRequest("submit", submitContent)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

