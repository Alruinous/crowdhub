// 认领日常任务子任务（仅 worker；每个子任务限一人，同一 worker 可认领多个子任务）
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
    if (session.user.role !== "WORKER") {
      return NextResponse.json({ error: "只有 Worker 用户可以认领子任务" }, { status: 403 });
    }

    const { id: taskId, subtaskId } = await params;

    const task = await db.normalTask.findUnique({
      where: { id: taskId },
      select: { id: true, status: true },
    });
    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (task.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "任务未发布或已完成，无法认领子任务" }, { status: 400 });
    }

    const subtask = await db.normalSubtask.findUnique({
      where: { id: subtaskId },
    });
    if (!subtask || subtask.taskId !== taskId) {
      return NextResponse.json({ error: "子任务不存在" }, { status: 404 });
    }
    if (subtask.status !== "OPEN" || subtask.workerId) {
      return NextResponse.json({ error: "该子任务已被认领" }, { status: 400 });
    }

    await db.normalSubtask.update({
      where: { id: subtaskId },
      data: { workerId: session.user.id, status: "IN_PROGRESS" },
    });

    return NextResponse.json({ success: true, message: "认领成功" });
  } catch (error) {
    console.error("认领子任务失败:", error);
    return NextResponse.json({ error: "认领子任务失败，请稍后重试" }, { status: 500 });
  }
}
