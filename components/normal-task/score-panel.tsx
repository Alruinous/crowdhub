"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Star, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

export interface ScoredSubtaskRow {
  subtaskId: string;
  title: string;
  workerName: string;
  /** 该子任务价值分数（打分上限） */
  points: number;
  /** 已打真实得分；未打分则为 null */
  score: number | null;
  /** 子任务当前状态（仅 PENDING_REVIEW 可打分） */
  status: string;
}

/** 行内打分单元格：未打分显示输入框 + 打分按钮，已打分靠右显示真实得分 */
function SubtaskScoreCell({
  taskId,
  subtaskId,
  workerName,
  points,
  score,
  status,
}: {
  taskId: string;
  subtaskId: string;
  workerName: string;
  points: number;
  score: number | null;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  if (score !== null) {
    return (
      <span className="flex justify-end items-center gap-1 text-sm tabular-nums">
        <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        <span>{score}</span>
      </span>
    );
  }

  // 子任务尚未提交（非待确认状态），不能打分
  if (status !== "PENDING_REVIEW") {
    return (
      <span className="flex justify-end text-xs text-muted-foreground">待提交</span>
    );
  }

  const handleSubmit = async () => {
    const n = Number(value);
    if (!value || Number.isNaN(n) || !Number.isInteger(n) || n < 1 || n > 10) {
      toast({ title: "打分不合法", description: "请输入 1 ~ 10 之间的整数", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/normal-tasks/${taskId}/score-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtaskId, score: n }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "打分失败");
      }
      toast({ title: "打分成功", description: `${workerName} 真实得分：${result.score} 积分` });
      router.refresh();
    } catch (error) {
      toast({
        title: "打分失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="flex items-center justify-end gap-2">
      <Input
        type="number"
        min={1}
        max={10}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="1~10"
        className="w-20 h-8"
        disabled={loading}
      />
      <Button size="sm" onClick={handleSubmit} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "打分"}
      </Button>
    </span>
  );
}

export function ScorePanel({
  taskId,
  subtasks,
}: {
  taskId: string;
  subtasks: ScoredSubtaskRow[];
}) {
  if (subtasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">标注员任务完成情况</CardTitle>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="leading-relaxed">真实得分 = 子任务分数 × 打分/10（四舍五入）</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">为每个已认领的子任务从 1-10 打个分</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>子任务</TableHead>
              <TableHead>认领人</TableHead>
              <TableHead>子任务分数 </TableHead>
              <TableHead className="text-right">打分</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subtasks.map((s) => (
              <TableRow key={s.subtaskId}>
                <TableCell>{s.title}</TableCell>
                <TableCell>{s.workerName}</TableCell>
                <TableCell>{s.points}</TableCell>
                <TableCell>
                  <SubtaskScoreCell
                    taskId={taskId}
                    subtaskId={s.subtaskId}
                    workerName={s.workerName}
                    points={s.points}
                    score={s.score}
                    status={s.status}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
