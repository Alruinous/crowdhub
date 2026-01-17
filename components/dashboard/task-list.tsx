"use client"

import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Eye, FileText, Database } from "lucide-react";
import { TASK_TYPE_MAP } from "@/lib/task-types";

interface TaskListProps {
  tasks: any[];
  userRole: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
  };
  // 额外需要在分页链接中保留的查询参数（例如 search、status 等）
  query?: Record<string, string>;
  // 是否显示提交按钮（仅对工作者的标注任务有效）
  showSubmitButton?: boolean;
}

export function TaskList({ tasks, userRole, pagination, query, showSubmitButton = false }: TaskListProps) {
  const router = useRouter();
  
  // 对于工作者用户，传入的是子任务数组，需要按任务分组以聚合状态
  let displayTasks = tasks;
  let taskSubtasksMap = new Map<string, any[]>();
  
  if (userRole === "WORKER") {
    // 工作者：按任务ID分组所有子任务
    tasks.forEach(task => {
      if ("task" in task) {
        const taskId = task.task.id;
        if (!taskSubtasksMap.has(taskId)) taskSubtasksMap.set(taskId, []);
        taskSubtasksMap.get(taskId)!.push(task);
      } else {
        const taskId = task.id;
        if (!taskSubtasksMap.has(taskId)) taskSubtasksMap.set(taskId, [task]);
      }
    });
    // 每组选择最新子任务作为卡片展示基准
    displayTasks = Array.from(taskSubtasksMap.entries()).map(([_, subtasks]) =>
      subtasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    );
  }

  if (displayTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">暂无任务</p>
      </div>
    );
  }

  // Helper function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-green-500";
      case "IN_PROGRESS":
        return "bg-blue-500";
      case "COMPLETED":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  // Helper function to get task type badge color
  const getTaskTypeColor = (taskType: string) => {
    switch (taskType) {
      case "task":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "annotationTask":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Helper function to get task type icon
  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case "task":
        return <FileText className="h-4 w-4" />;
      case "annotationTask":
        return <Database className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {displayTasks.map((task) => {
        // Handle both task and subtask structures
        const isSubtask = "task" in task;
        const taskData = isSubtask ? task.task : task;
        const taskId = taskData.id;
        const taskTitle = taskData.title;
        const taskStatus = taskData.status;
        const taskCategory = taskData.category?.name || "未分类";
        const taskDate = new Date(taskData.createdAt || Date.now());
        const taskType = taskData.taskType || "task"; // 默认为task

        // 聚合状态徽标逻辑
        let aggregatedStatusText: string | null = null;
        let aggregatedStatusColor: string = getStatusColor(taskStatus);
        if (userRole === "WORKER" && taskSubtasksMap.has(taskId)) {
          const statuses = (taskSubtasksMap.get(taskId) || []).map(st => st.status as string);
          // 规则：若存在进行中则显示进行中；若全部完成则显示已完成；否则显示待审核
          const hasInProgress = statuses.some(s => ["IN_PROGRESS", "CLAIMED", "OPEN", "REJECTED"].includes(s));
          const allCompleted = statuses.length > 0 && statuses.every(s => s === "COMPLETED");
          const showPending = !hasInProgress && !allCompleted; // 其余情况视为待审核
          if (hasInProgress) {
            aggregatedStatusText = "进行中";
            aggregatedStatusColor = "bg-blue-500";
          } else if (allCompleted) {
            aggregatedStatusText = "已完成";
            aggregatedStatusColor = "bg-purple-500";
          } else if (showPending) {
            aggregatedStatusText = "待审核";
            aggregatedStatusColor = "bg-orange-500";
          }
        }

        // 根据任务类型生成正确的链接
        const taskLink = taskType === "annotationTask" 
          ? `/annotation-tasks/${taskId}`
          : `/tasks/${taskId}`;

        return (
          <Card key={isSubtask ? `${taskId}-${task.id}` : taskId} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{taskTitle}</CardTitle>
                <div className="flex flex-col gap-1 items-end">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getTaskTypeColor(taskType)}`}
                  >
                    <span className="flex items-center gap-1">
                      {getTaskTypeIcon(taskType)}
                      {TASK_TYPE_MAP[taskType as keyof typeof TASK_TYPE_MAP]?.label || taskType}
                    </span>
                  </Badge>
                  {/* 发布者显示任务状态；接单者显示聚合状态 */}
                  {userRole === "WORKER" && aggregatedStatusText ? (
                    <Badge className={aggregatedStatusColor}>{aggregatedStatusText}</Badge>
                  ) : (
                    <Badge className={getStatusColor(taskStatus)}>
                      {taskStatus === "OPEN" ? "招募中" : taskStatus === "IN_PROGRESS" ? "进行中" : taskStatus === "COMPLETED" ? "已完成" : taskStatus}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid gap-2">
                <div className="text-sm">
                  <span className="font-medium">分类：</span>
                  {taskCategory}
                </div>
                <div className="text-sm">
                  <span className="font-medium">积分：</span>
                  {taskData.points || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(taskDate, {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="mt-auto flex justify-between items-center gap-2">
              <div className="flex-1">
                {/* 显示标注任务的进度 */}
                {taskType === "annotationTask" && task.annotationProgress && (
                  <div className="text-xs text-muted-foreground">
                    标注进度: {task.annotationProgress.finished} / {task.annotationProgress.total}
                  </div>
                )}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={taskLink}>
                  <Eye className="mr-2 h-4 w-4" />
                  查看详情
                </Link>
              </Button>
            </CardFooter>
          </Card>
        );
      })}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
            (page) => (
              <Button
                key={page}
                variant={
                  page === pagination.currentPage ? "default" : "outline"
                }
                size="sm"
                asChild
              >
                <Link
                  href={{
                    query: { ...(query || {}), page },
                  }}
                >
                  {page}
                </Link>
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
