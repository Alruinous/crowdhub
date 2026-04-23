import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeAndPersistCorrectPointsForTask } from "@/lib/annotation-scoring";

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
      return NextResponse.json({ error: "无权限执行该操作" }, { status: 403 });
    }

    // 计算 correctPoint 不应只限定已完成结果：
    // - 论文口径是“每条 annotationResult 都要打分”
    const stats = await computeAndPersistCorrectPointsForTask(taskId, {
      onlyFinished: true,
    });

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("计算并写回 correctPoint 失败:", error);
    return NextResponse.json(
      { error: "计算并写回 correctPoint 失败，请稍后重试" },
      { status: 500 }
    );
  }
}

