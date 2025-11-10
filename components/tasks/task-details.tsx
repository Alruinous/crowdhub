import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TaskActions } from "@/components/tasks/task-actions";

interface TaskDetailsProps {
  task: any;
  session: any;
}

export function TaskDetails({ task, session }: TaskDetailsProps) {
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

  const isPublisher = task.publisher.id === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const canEdit = isPublisher || isAdmin;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl">{task.title}</CardTitle>
          <div className="flex items-center gap-2">
            {!task.approved && (
              <Badge
                variant="outline"
                className="border-yellow-500 text-yellow-500"
              >
                待审核
              </Badge>
            )}
            <Badge className={getStatusColor(task.status)}>
              {task.status === "OPEN"
                ? "招募中"
                : task.status === "IN_PROGRESS"
                ? "进行中"
                : task.status === "COMPLETED"
                ? "已完成"
                : task.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium">发布者</p>
            <p className="text-sm">{task.publisher.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium">学科分类</p>
            <p className="text-sm">{task.category.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium">分类</p>
            <p className="text-sm">{task.type.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium">发布时间</p>
            <p className="text-sm">
              {formatDistanceToNow(new Date(task.createdAt), {
                addSuffix: true,
                locale: zhCN,
              })}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">总积分</p>
            <p className="text-sm">{task.points}</p>
          </div>
          <div>
            <p className="text-sm font-medium">最大接单人数</p>
            <p className="text-sm">{task.maxWorkers}</p>
          </div>
          <div>
            <p className="text-sm font-medium">当前接单人数</p>
            <p className="text-sm">
              {task.subtasks.filter((subtask) => subtask.workerId).length} /{" "}
              {task.maxWorkers}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">任务描述</p>
          <div className="text-sm whitespace-pre-line bg-muted p-4 rounded-md">
            {task.description}
          </div>
        </div>
      </CardContent>
      {canEdit && (
        <CardFooter>
          <TaskActions task={task} isAdmin={isAdmin} />
        </CardFooter>
      )}
    </Card>
  );
}
