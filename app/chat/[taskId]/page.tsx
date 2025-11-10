import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage({ params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const taskId = params.taskId;

  // Get task with participants
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      publisher: {
        select: { id: true, name: true },
      },
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

  // Check if user is allowed to access this chat
  const isPublisher = task.publisher.id === session.user.id;
  const isWorker = task.subtasks.some(
    (subtask) => subtask.workerId === session.user.id
  );
  const isAdmin = session.user.role === "ADMIN";

  if (!isPublisher && !isWorker && !isAdmin) {
    redirect("/dashboard");
  }

  // Get previous messages
  const messages = await db.message.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: {
        select: { id: true, name: true },
      },
    },
  });

  // Get participants
  const participants = [
    task.publisher,
    ...task.subtasks.map((subtask) => subtask.worker),
  ].filter(
    (value, index, self) =>
      index === self.findIndex((t) => t && value && t.id === value.id)
  );

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`任务聊天: ${task.title}`}
        text="与任务相关人员进行沟通"
      />

      <ChatInterface
        taskId={taskId}
        userId={session.user.id}
        userName={session.user.name || ""}
        initialMessages={messages}
        participants={participants}
      />
    </DashboardShell>
  );
}
