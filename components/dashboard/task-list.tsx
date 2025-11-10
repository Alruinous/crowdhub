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
import { Eye } from "lucide-react";

interface TaskListProps {
  tasks: any[];
  userRole: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
  };
}

export function TaskList({ tasks, userRole, pagination }: TaskListProps) {
  if (tasks.length === 0) {
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

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {tasks.map((task) => {
        // Handle both task and subtask structures
        const isSubtask = "task" in task;
        const taskData = isSubtask ? task.task : task;
        const taskId = taskData.id;
        const taskTitle = taskData.title;
        const taskStatus = taskData.status;
        const taskCategory = taskData.category?.name || "未分类";
        const taskDate = new Date(taskData.createdAt || Date.now());

        return (
          <Card key={isSubtask ? `${taskId}-${task.id}` : taskId}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{taskTitle}</CardTitle>
                <Badge className={getStatusColor(taskStatus)}>
                  {taskStatus === "OPEN"
                    ? "招募中"
                    : taskStatus === "IN_PROGRESS"
                    ? "进行中"
                    : taskStatus === "COMPLETED"
                    ? "已完成"
                    : taskStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="text-sm">
                  <span className="font-medium">分类：</span>
                  {taskCategory}
                </div>
                {isSubtask && (
                  <div className="text-sm">
                    <span className="font-medium">子任务：</span>
                    {task.title}
                  </div>
                )}
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
                <Link href={`/tasks/${taskId}`}>
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
                    query: { page },
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
