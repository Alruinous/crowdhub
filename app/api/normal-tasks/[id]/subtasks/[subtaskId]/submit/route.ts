// 提交日常任务子任务（仅认领该子任务的 worker）：IN_PROGRESS -> PENDING_REVIEW
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

    const { id: taskId, subtaskId } = await params;

    // 获取提交的文字内容
    const body = await request.json().catch(() => ({}));
    const { content } = body as { content?: string };

    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: "提交内容不能为空" }, { status: 400 });
    }

    const subtask = await db.normalSubtask.findUnique({
      where: { id: subtaskId },
    });
    if (!subtask || subtask.taskId !== taskId) {
      return NextResponse.json({ error: "子任务不存在" }, { status: 404 });
    }
    if (subtask.workerId !== session.user.id) {
      return NextResponse.json({ error: "只有认领人可以提交该子任务" }, { status: 403 });
    }
    if (subtask.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "只有进行中的子任务可以提交" }, { status: 400 });
    }

    await db.normalSubtask.update({
      where: { id: subtaskId },
      data: {
        status: "PENDING_REVIEW",
        submissionText: String(content).trim(),
      },
    });

    return NextResponse.json({ success: true, message: "已提交，等待发布者确认" });
  } catch (error) {
    console.error("提交子任务失败:", error);
    return NextResponse.json({ error: "提交子任务失败，请稍后重试" }, { status: 500 });
  }
}
