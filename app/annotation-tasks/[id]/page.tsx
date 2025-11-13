import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Edit, Database, FileText, User } from "lucide-react";
import Link from "next/link";
import { AnnotationTaskStatus } from "@prisma/client";
import { ClaimButton } from "@/components/annotation/claim-button";
import { ExportButton } from "@/components/annotation/export-button";

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

  // Get annotation task with subtasks
  const task = await db.annotationTask.findUnique({
    where: { id: taskId },
    include: {
      publisher: {
        select: { id: true, name: true },
      },
      category: true,
      dataFile: true,
      labelFile: true,
      subtasks: {
        include: {
          worker: {
            select: { id: true, name: true },
          },
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

  // Check if user has claimed any subtask
  const hasClaimedSubtask = task.subtasks.some(
    (subtask) => subtask.workerId === session.user.id
  );

  return (
    <DashboardShell>
      <DashboardHeader
        heading={task.title}
        text={`标注任务 | 类别: ${task.category?.name || "未分类"} | 状态: ${task.status}`}
      >
        {/* 当用户是任务发布者时显示编辑按钮 */}
        <div className="flex items-center justify-end gap-3">
          {task.publisher.id === session.user.id && (
            <>
              <ExportButton taskId={taskId} taskTitle={task.title} />
              <Button asChild variant="outline">
                <Link href={`/annotation-tasks/${taskId}/edit`}>
                  <Edit className="h-4 w-4" />
                  编辑
                </Link>
              </Button>
            </>
          )}
          {(task.publisher.id === session.user.id || hasClaimedSubtask) && (
            <Button asChild variant="outline">
              <Link href={`/annotation-chat/${taskId}`}>
                <MessageCircle className="h-4 w-4" />
                聊天
              </Link>
            </Button>
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
                  <span className="text-muted-foreground">任务状态:</span>
                  <div className="font-medium">
                    <Badge variant={
                      task.status === "OPEN" ? "default" :
                      task.status === "IN_PROGRESS" ? "secondary" : "outline"
                    }>
                      {task.status === "OPEN" ? "开放中" :
                       task.status === "IN_PROGRESS" ? "进行中" : "已完成"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">审批状态:</span>
                  <div className="font-medium">
                    <Badge variant={task.approved ? "default" : "secondary"}>
                      {task.approved ? "已审批" : "待审批"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">总积分:</span>
                  <div className="font-medium">{task.points}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">最大接单者:</span>
                  <div className="font-medium">{task.maxWorkers}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">创建时间:</span>
                  <div className="font-medium">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">更新时间:</span>
                  <div className="font-medium">
                    {new Date(task.updatedAt).toLocaleDateString()}
                  </div>
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
              <p className="text-sm text-muted-foreground">
                {task.description || "暂无详细描述"}
              </p>
            </CardContent>
          </Card>

          {/* 文件信息 */}
          <Card>
            <CardHeader>
              <CardTitle>文件信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">数据文件</div>
                  <div className="text-sm text-muted-foreground">
                    {task.dataFile ? task.dataFile.originalName : "未上传"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">标签文件</div>
                  <div className="text-sm text-muted-foreground">
                    {task.labelFile ? task.labelFile.originalName : "未上传"}
                  </div>
                </div>
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
                  <span className="text-muted-foreground">总子任务数:</span>
                  <span className="font-medium">{task.subtasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已认领:</span>
                  <span className="font-medium">
                    {task.subtasks.filter(st => st.status === "CLAIMED" || st.status === "IN_PROGRESS" || st.status === "COMPLETED").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已完成:</span>
                  <span className="font-medium">
                    {task.subtasks.filter(st => st.status === "COMPLETED").length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 子任务列表 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">子任务列表</h2>
        <div className="space-y-4">
          {task.subtasks.map((subtask) => (
            <Card key={subtask.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{subtask.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {subtask.status === "OPEN" ? "开放" :
                         subtask.status === "CLAIMED" ? "已认领" :
                         subtask.status === "IN_PROGRESS" ? "标注中" :
                         subtask.status === "COMPLETED" ? "已完成" : "待审核"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {subtask.description || "暂无描述"}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>积分: {subtask.points}</span>
                      <span>创建时间: {new Date(subtask.createdAt).toLocaleDateString()}</span>
                      {subtask.worker && (
                        <span>认领者: {subtask.worker.name}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* 认领按钮 */}
                  {session.user.role === "WORKER" && 
                   subtask.status === "OPEN" && 
                   task.approved && 
                   subtask.workerId !== session.user.id && (
                    <ClaimButton subtaskId={subtask.id} taskId={task.id} />
                  )}
                  
                  {/* 如果用户已经认领了这个子任务 */}
                  {subtask.workerId === session.user.id && (
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/annotation-tasks/${task.id}/annotate?subtaskId=${subtask.id}`}>
                          开始标注
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {task.subtasks.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">暂无子任务</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
