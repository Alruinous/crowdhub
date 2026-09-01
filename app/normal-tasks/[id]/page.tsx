import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { PublishButton } from "@/components/normal-task/publish-button";
import { ResplitButton } from "@/components/normal-task/resplit-button";
import { DeleteButton } from "@/components/normal-task/delete-button";
import { SubtaskActions, SubtaskStatusBadge } from "@/components/normal-task/subtask-actions";
import { ViewSubmissionButton } from "@/components/normal-task/view-submission-button";
import { ScorePanel, ScoredSubtaskRow } from "@/components/normal-task/score-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NormalTaskDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const task = await db.normalTask.findUnique({
    where: { id },
    include: {
      publisher: { select: { id: true, name: true } },
      subtasks: {
        orderBy: { createdAt: "asc" },
        include: { worker: { select: { id: true, name: true } } },
      },
      scores: true,
    },
  });

  if (!task) {
    notFound();
  }

  const isPublisher = task.publisher.id === session.user.id;
  const isWorker = session.user.role === "WORKER";
  const isAdmin = session.user.role === "ADMIN";

  // 已认领子任务的打分数据（按子任务，上限 = 该子任务价值分数）
  const scoredSubtasks: ScoredSubtaskRow[] = task.subtasks
    .filter((s) => s.workerId && s.worker)
    .map((s) => {
      const scored = task.scores.find((sc) => sc.subtaskId === s.id);
      return {
        subtaskId: s.id,
        title: s.title,
        workerName: s.worker!.name,
        points: s.points,
        score: scored?.score ?? null,
      };
    });

  const statusText = task.status === "OPEN" ? "待发布" : task.status === "IN_PROGRESS" ? "进行中" : "已完成";

  // 任务统计
  const claimedCount = task.subtasks.filter((s) => s.workerId).length;

  return (
    <DashboardShell>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧主内容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 任务信息 */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <CardTitle className="text-xl">{task.title}</CardTitle>
                  <CardDescription className="mt-1">
                    发布者：{task.publisher.name} · 总积分：{task.points}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge>{statusText}</Badge>
                  {(isPublisher || isAdmin) && <DeleteButton taskId={task.id} />}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground mr-1">总积分:</span>
                  <span className="font-medium">{task.points}</span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1">子任务数:</span>
                  <span className="font-medium">{task.subtasks.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1">创建时间:</span>
                  <span className="font-medium">{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">任务描述</p>
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-[2.1] bg-muted p-4 rounded-md">
                  {task.description}
                </div>
              </div>

              {isPublisher && task.status === "OPEN" && (
                <div className="flex flex-wrap items-center gap-3">
                  <PublishButton taskId={task.id} />
                  <ResplitButton taskId={task.id} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 子任务列表 */}
          {(task.status === "OPEN" || task.status === "IN_PROGRESS") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">子任务列表</CardTitle>
                <CardDescription>
                  {task.status === "OPEN"
                    ? "发布前由 AI 拆解的子任务，可点击重新拆分"
                    : "每个子任务限一人认领，认领后完成并提交"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.subtasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无子任务</p>
                ) : (
                  task.subtasks.map((s, i) => (
                    <div key={s.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{i + 1}. {s.title}</span>
                            <Badge variant="secondary" className="text-xs">{s.points} 分</Badge>
                            <SubtaskStatusBadge status={s.status} />
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                            {s.description}
                          </p>
                          {s.worker && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">认领人：</span>{s.worker.name}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {(isPublisher || isAdmin) && s.submissionText && (
                            <ViewSubmissionButton content={s.submissionText} workerName={s.worker?.name} />
                          )}
                          <SubtaskActions
                            taskId={task.id}
                            subtaskId={s.id}
                            status={s.status}
                            isClaimedByMe={s.workerId === session.user.id}
                            isWorker={isWorker}
                            workerName={s.worker?.name}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* 打分面板 */}
          {isPublisher && task.status === "IN_PROGRESS" && (
            <ScorePanel taskId={task.id} subtasks={scoredSubtasks} />
          )}
        </div>

        {/* 右侧侧栏 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">发布者信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-gray-500" />
                <div>
                  <div className="font-medium">{task.publisher.name}</div>
                  <div className="text-sm text-muted-foreground">任务发布者</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">任务统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">子任务数量:</span>
                  <span className="font-medium">{task.subtasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已认领子任务:</span>
                  <span className="font-medium">{claimedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">任务总积分:</span>
                  <span className="font-medium">{task.points}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
