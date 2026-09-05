"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Star, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { UndoAnnotationForm } from "@/components/annotation/undo-annotation-form";

export interface WorkerStat {
  userId: string;
  name: string;
  total: number;
  finished: number;
  needReview: number;
  /** 上次下发复审后的新增已完成 */
  finishedNotSentToReview: number;
  /** 上述新增中需复审且尚未下发的条数 */
  needReviewNotSentToReview: number;
  /** 发布者给的真实得分（上限 × 打分/10 四舍五入；未打分则为 null） */
  score: number | null;
}

export interface ReviewerStat {
  userId: string;
  name: string;
  assigned: number;
  finished: number;
}

/** 复审汇总：共需复审数、已发放数（未发放 = 共需复审 - 已发放） */
export interface ReviewSummary {
  totalNeedReview: number;
  distributed: number;
}

/** 二级复审汇总 */
export interface ReviewSummaryL2 {
  totalNeedReview2: number;
  distributedL2: number;
}

interface TaskStatusTabsProps {
  taskId: string;
  workerStats: WorkerStat[];
  reviewerStats: ReviewerStat[];
  /** 二级复审员进度（与 reviewerStats 结构相同，round=2） */
  reviewerStatsL2?: ReviewerStat[];
  workers: { userId: string; name: string }[];
  /** 每位标注者的打分上限（总积分 ÷ 当前认领人数，四舍五入） */
  maxScore: number;
  /** 一级复审汇总，用于在「一级复审员进度」下显示小字 */
  reviewSummary?: ReviewSummary;
  /** 二级复审汇总，用于在「二级复审员进度」下显示小字 */
  reviewSummaryL2?: ReviewSummaryL2;
  /** 放在切换按钮右侧的按钮（如下发复审、更新任务状态） */
  headerButtons?: React.ReactNode;
}

/** 标注员表格行内的打分单元格：每人每任务一次，积分汇入标注者账户 */
function WorkerScoreCell({
  taskId,
  workerId,
  name,
  score,
  maxScore,
  finished,
  total,
}: {
  taskId: string;
  workerId: string;
  name: string;
  score: number | null;
  maxScore: number;
  /** 该标注者已完成的条目数 */
  finished: number;
  /** 该标注者需标注的总条目数 */
  total: number;
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

  // 只有标注完所有需要标注的条目后，发布者才能为其打分
  if (!(total > 0 && finished >= total)) {
    return (
      <span className="flex justify-end text-xs text-muted-foreground">未完成全部标注</span>
    );
  }

  const handleSubmit = async () => {
    const n = Number(value);
    if (!value || Number.isNaN(n) || !Number.isInteger(n) || n < 1 || n > 10) {
      toast({
        title: "打分不合法",
        description: `请输入 1 ~ 10 之间的整数`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/annotation-tasks/${taskId}/score-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, score: n }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "打分失败");
      }
      toast({
        title: "打分成功",
        description: `${name} 真实得分：${maxScore} × ${n}/10 = ${Math.round((maxScore * n) / 10)} 积分`,
      });
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

export function TaskStatusTabs({
  taskId,
  workerStats,
  reviewerStats,
  reviewerStatsL2 = [],
  workers,
  maxScore,
  reviewSummary,
  reviewSummaryL2,
  headerButtons,
}: TaskStatusTabsProps) {
  return (
    <Card className="mt-6">
      <Tabs defaultValue="annotators" className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>任务状态</CardTitle>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="annotators">标注员</TabsTrigger>
              <TabsTrigger value="reviewers">复审员</TabsTrigger>
            </TabsList>
            {headerButtons}
          </div>
        </CardHeader>
        <CardContent>
          <TabsContent value="annotators" className="space-y-6 mt-0">
        {workerStats.length > 0 ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-medium">每人任务完成情况与复审率</h4>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">为你的标注者从 1-10 打个分</span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="leading-relaxed">每人上限 {maxScore}，真实得分 = 上限 × 打分/10（四舍五入）</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">标注员</th>
                    <th className="text-right p-3 font-medium">已完成 / 总需标注</th>
                    <th className="text-right p-3 font-medium">复审率（需复审/已完成）</th>
                    <th className="text-right p-3 font-medium">复审后新增：需复审/已完成</th>
                    <th className="text-right p-3 font-medium">打分</th>
                  </tr>
                </thead>
                <tbody>
                  {workerStats.map((ws) => (
                    <tr key={ws.userId} className="border-b last:border-0">
                      <td className="p-3">{ws.name}</td>
                      <td className="p-3">
                        <span className="flex justify-end items-baseline gap-6">
                          <span className="tabular-nums">{ws.finished} / {ws.total}</span>
                          {ws.total > 0 && (() => {
                            const pct = (ws.finished / ws.total) * 100;
                            const colorClass = pct < 50 ? "text-red-500" : pct <= 80 ? "text-yellow-500" : "text-muted-foreground";
                            return (
                              <span className={colorClass}>
                                {pct.toFixed(1)}%
                              </span>
                            );
                          })()}
                        </span>
                      </td>
                      <td className="p-3">
                        {ws.finished === 0 ? (
                          <span className="flex justify-end">—</span>
                        ) : (
                          <span className="flex justify-end items-baseline gap-6">
                            <span className="tabular-nums">{ws.needReview} / {ws.finished}</span>
                            <span className={(ws.needReview / ws.finished) * 100 > 70 ? "text-red-500" : "text-muted-foreground"}>
                              {((ws.needReview / ws.finished) * 100).toFixed(1)}%
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {(ws.finishedNotSentToReview ?? 0) === 0 ? (
                          <span className="flex justify-end tabular-nums">0 / 0</span>
                        ) : (
                          <span className="flex justify-end items-baseline gap-6">
                            <span className="tabular-nums">
                              {ws.needReviewNotSentToReview ?? 0} / {ws.finishedNotSentToReview}
                            </span>
                            <span
                              className={
                                ((ws.needReviewNotSentToReview ?? 0) / (ws.finishedNotSentToReview ?? 1)) * 100 > 70
                                  ? "text-red-500"
                                  : "text-muted-foreground"
                              }
                            >
                              {(((ws.needReviewNotSentToReview ?? 0) / (ws.finishedNotSentToReview ?? 1)) * 100).toFixed(1)}%
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <WorkerScoreCell
                          taskId={taskId}
                          workerId={ws.userId}
                          name={ws.name}
                          score={ws.score}
                          maxScore={maxScore}
                          finished={ws.finished}
                          total={ws.total}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无标注员数据</p>
        )}
        <UndoAnnotationForm taskId={taskId} workers={workers} />
      </TabsContent>
      <TabsContent value="reviewers" className="space-y-6 mt-0">
        <div className="space-y-6">
          {/* 一级复审员进度 */}
          <div>
            <h4 className="text-sm font-medium mb-1">一级复审员进度</h4>
            {reviewSummary != null && (
              <p className="text-xs text-muted-foreground mb-3">
                共需复审 {reviewSummary.totalNeedReview}，已发放 {reviewSummary.distributed}，未发放 {Math.max(0, reviewSummary.totalNeedReview - reviewSummary.distributed)}
              </p>
            )}
            {reviewerStats.length > 0 ? (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">复审员</th>
                      <th className="text-right p-3 font-medium">已完成/总需复审</th>
                      <th className="text-right p-3 font-medium">完成率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewerStats.map((rs) => (
                      <tr key={rs.userId} className="border-b last:border-0">
                        <td className="p-3">{rs.name}</td>
                        <td className="p-3 text-right tabular-nums">{rs.finished} / {rs.assigned}</td>
                        <td className="p-3 text-right">
                          {rs.assigned === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={rs.finished / rs.assigned * 100 < 40 ? "text-red-500" : "text-muted-foreground"}>
                              {(rs.finished / rs.assigned * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无一级复审员，请在「添加复审员」中指定</p>
            )}
          </div>

          {/* 二级复审员进度 */}
          <div>
            <h4 className="text-sm font-medium mb-1">二级复审员进度</h4>
            {reviewSummaryL2 != null && (
              <p className="text-xs text-muted-foreground mb-3">
                共需二级复审 {reviewSummaryL2.totalNeedReview2}，已发放 {reviewSummaryL2.distributedL2}，未发放 {Math.max(0, reviewSummaryL2.totalNeedReview2 - reviewSummaryL2.distributedL2)}
              </p>
            )}
            {reviewerStatsL2.length > 0 ? (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">复审员</th>
                      <th className="text-right p-3 font-medium">已完成/总需复审</th>
                      <th className="text-right p-3 font-medium">完成率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewerStatsL2.map((rs) => (
                      <tr key={rs.userId} className="border-b last:border-0">
                        <td className="p-3">{rs.name}</td>
                        <td className="p-3 text-right tabular-nums">{rs.finished} / {rs.assigned}</td>
                        <td className="p-3 text-right">
                          {rs.assigned === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={rs.finished / rs.assigned * 100 < 40 ? "text-red-500" : "text-muted-foreground"}>
                              {(rs.finished / rs.assigned * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无二级复审员，请在「添加复审员」中指定</p>
            )}
          </div>
        </div>
      </TabsContent>
        </CardContent>
        </Tabs>
    </Card>
  );
}
