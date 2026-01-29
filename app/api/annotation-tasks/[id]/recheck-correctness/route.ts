import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recheckTaskCorrectness } from "@/lib/annotation-scheduler";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id: taskId } = await params;

    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      select: { id: true, publisherId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const isPublisherOrAdmin =
      task.publisherId === session.user.id || session.user.role === "ADMIN";
    if (!isPublisherOrAdmin) {
      return NextResponse.json(
        { error: "只有任务发布者或管理员可更新任务状态" },
        { status: 403 }
      );
    }

    const { checked } = await recheckTaskCorrectness(taskId);

    return NextResponse.json({
      success: true,
      message: "任务状态已更新",
      checked,
    });
  } catch (error) {
    console.error("更新任务状态失败:", error);
    return NextResponse.json(
      { error: "更新任务状态失败，请稍后重试" },
      { status: 500 }
    );
  }
}
