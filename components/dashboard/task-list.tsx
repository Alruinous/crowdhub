import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
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

interface TaskListProps {
  tasks: any[];
  userRole: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
  };
  // 额外需要在分页链接中保留的查询参数（例如 search、status 等）
  query?: Record<string, string>;
}

export function TaskList({ tasks, userRole, pagination, query }: TaskListProps) {
  // 对于工作者用户，传入的是子任务数组，需要按任务去重
  let displayTasks = tasks;
  
  if (userRole === "WORKER") {
    // 工作者：按任务ID去重，只显示每个任务的最新子任务
    const taskMap = new Map();
    
    tasks.forEach(task => {
      // 工作者传入的是子任务，包含task字段
      if ("task" in task) {
        const taskId = task.task.id;
        const existingTask = taskMap.get(taskId);
        
        // 如果任务不存在，或者当前子任务更新，则更新
        if (!existingTask || new Date(task.createdAt) > new Date(existingTask.createdAt)) {
          taskMap.set(taskId, task);
        }
      } else {
        // 如果是任务对象（不是子任务），直接添加到显示列表
        taskMap.set(task.id, task);
      }
    });
    
    displayTasks = Array.from(taskMap.values());
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
      case "科普任务":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "标注任务":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Helper function to get task type icon
  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case "科普任务":
        return <FileText className="h-4 w-4" />;
      case "标注任务":
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
        const taskType = taskData.taskType || "科普任务"; // 默认为科普任务

        // 根据任务类型生成正确的链接
        const taskLink = taskType === "标注任务" 
          ? `/annotation-tasks/${taskId}`
          : `/tasks/${taskId}`;

        return (
          <Card key={isSubtask ? `${taskId}-${task.id}` : taskId}>
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
                      {taskType}
                    </span>
                  </Badge>
                  {/* 显示审批状态 - 审核中的任务只显示审核中，不显示状态 */}
                  {!taskData.approved ? (
                    <Badge className="bg-yellow-500">
                      审核中
                    </Badge>
                  ) : (
                    <Badge className={getStatusColor(taskStatus)}>
                      {taskStatus === "OPEN"
                        ? "招募中"
                        : taskStatus === "IN_PROGRESS"
                        ? "进行中"
                        : taskStatus === "COMPLETED"
                        ? "已完成"
                        : taskStatus}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
            <CardFooter>
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
