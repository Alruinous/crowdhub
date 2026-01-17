import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Edit, Database, FileText, User, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AnnotationTaskStatus } from "@prisma/client";
import { ExportButton } from "@/components/annotation/export-button";
import { DeleteTaskButton } from "@/components/annotation/delete-task-button";
import { ClaimButton } from "@/components/annotation/claim-button";
import { PublishButton } from "@/components/annotation/publish-button";

interface AnnotationTaskPageProps {
  params: {
    id: string;
  };
}

export default async function AnnotationTaskPage({ params }: AnnotationTaskPageProps) {
  const session = await getServerSession(authOptions);

  
  if (!session) {
    redirect("/login");
  }

  const taskId = (await params).id;

  // Get annotation task with annotations and workers
  const task = await db.annotationTask.findUnique({
    where: { id: taskId },
    include: {
      publisher: {
        select: { id: true, name: true },
      },
      dataFile: true,
      labelFile: true,
      workers: {
        select: { id: true, name: true },
      },
      annotations: {
        select: { 
          id: true,
          status: true,
          rowIndex: true,
        },
      },
      _count: {
        select: {
          annotations: true,
          workers: true,
        },
      },
    },
  });

  if (!task) {
    notFound();
  }

  // Check if task is approved or user is the publisher or admin
  if (
    !task.approved &&
    task.publisher.id !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    redirect("/annotation-tasks");
  }

  // Check if user has claimed this task
  const hasClaimedTask = task.workers.some(
    (worker) => worker.id === session.user.id
  );

  // 获取当前用户的标注进度数据
  let userAnnotationProgress = null;
  if (session.user.role === "WORKER" && hasClaimedTask) {
    // 获取当前用户在该任务中完成的标注结果数量
    const finishedCount = await db.annotationResult.count({
      where: {
        annotatorId: session.user.id,
        annotation: {
          taskId: task.id
        },
        isFinished: true
      }
    });
    
    // 获取当前用户在该任务中的总标注结果数量
    const totalCount = await db.annotationResult.count({
      where: {
        annotatorId: session.user.id,
        annotation: {
          taskId: task.id
        }
      }
    });
    
    userAnnotationProgress = {
      finished: finishedCount,
      total: totalCount
    };
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={task.title}
      >
        {/* 当用户是任务发布者时显示编辑按钮 */}
        <div className="flex items-center justify-end gap-3">
          {task.publisher.id === session.user.id && (
            <>
              <ExportButton taskId={taskId} taskTitle={task.title} />
              <DeleteTaskButton taskId={taskId} />
            </>
          )}
        </div>
      </DashboardHeader>

      {/* 任务基本信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 左侧：任务详情 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>任务详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground mr-1">任务状态:</span>
                  <span className="font-medium">
                    {task.status === "OPEN"
                      ? "开放中"
                      : task.status === "IN_PROGRESS"
                        ? "进行中"
                        : "已完成"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1">审批状态:</span>
                  <span className="font-medium">
                    {task.approved ? "已审批" : "待审批"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1">总积分:</span>
                  <span className="font-medium">{task.points}</span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1">最大接单者:</span>
                  <span className="font-medium">{task.maxWorkers}</span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1">创建时间:</span>
                  <span className="font-medium">{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground mr-1">更新时间:</span>
                  <span className="font-medium">{new Date(task.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 任务描述 */}
          <Card>
            <CardHeader>
              <CardTitle>任务描述</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground whitespace-pre-line leading-[2.1]">
                {task.description || "暂无详细描述"}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* 右侧：发布者信息 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>发布者信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-gray-500" />
                <div>
                  <div className="font-medium">{task.publisher.name}</div>
                  <div className="text-sm text-muted-foreground">
                    任务发布者
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>任务统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已完成/总数据:</span>
                  <span className="font-medium">
                    {task.annotations.filter(a => a.status === "COMPLETED").length} / {task._count.annotations}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已认领人数:</span>
                  <span className="font-medium">
                    {task._count.workers} / {task.maxWorkers}
                  </span>
                </div>
                {/* 个人标注进度 - 仅对已认领该任务的工作者显示 */}
                {userAnnotationProgress && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">个人标注进度:</span>
                    <span className="font-medium">
                      {userAnnotationProgress.finished} / {userAnnotationProgress.total}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Worker用户显示认领/开始标注按钮，发布者显示发布按钮 */}
          <div className="flex justify-end gap-3">
            <PublishButton 
              taskId={taskId} 
              taskStatus={task.status} 
              isPublisher={task.publisher.id === session.user.id}
            />
            <ClaimButton 
              taskId={taskId} 
              hasClaimed={hasClaimedTask} 
              isWorker={session.user.role === "WORKER"}
              status={task.status}
              labelFileData={task.labelFile?.data as any}
            />
          </div>
        </div>
      </div>
      
    </DashboardShell>
  );
}
