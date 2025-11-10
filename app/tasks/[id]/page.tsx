import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { TaskDetails } from "@/components/tasks/task-details";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { Button } from "@/components/ui/button";
import { MessageCircle, Edit } from "lucide-react";
import Link from "next/link";
import { TaskStatus } from "@prisma/client";

export default async function TaskPage({ params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const taskId = params.id;

  // Get task with subtasks
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      publisher: {
        select: { id: true, name: true },
      },
      category: true,
      type: true,
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
    redirect("/tasks");
  }

  // Check if user has claimed any subtask
  const hasClaimedSubtask = task.subtasks.some(
    (subtask) => subtask.workerId === session.user.id
  );

  return (
    <DashboardShell>
      <DashboardHeader
        heading={task.title}
        text={`类别: ${task.category.name} | 状态: ${task.status}`}
      >
        {/* 当用户是任务发布者时显示编辑按钮 */}
        <div className="flex items-center justify-end gap-3">
          {task.publisher.id === session.user.id && (
            <Button asChild variant="outline">
              <Link href={`/tasks/${taskId}/edit`}>
                <Edit className="h-4 w-4" />
                编辑
              </Link>
            </Button>
          )}
          {(task.publisher.id === session.user.id || hasClaimedSubtask) && (
            <Button asChild variant="outline">
              <Link href={`/chat/${taskId}`}>
                <MessageCircle className="h-4 w-4" />
                聊天
              </Link>
            </Button>
          )}
        </div>
      </DashboardHeader>

      <TaskDetails task={task} session={session} />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">子任务列表</h2>
        <SubtaskList
          subtasks={task.subtasks}
          taskId={taskId}
          publisherId={task.publisher.id}
          userId={session.user.id}
          userRole={session.user.role}
        />
      </div>
    </DashboardShell>
  );
}
