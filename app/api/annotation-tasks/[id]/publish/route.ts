import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { processTaskById } from "@/lib/annotation-scheduler";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const taskId = (await params).id;

    // 获取任务信息
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        publisherId: true,
        approved: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // 检查是否是任务发布者
    if (task.publisherId !== session.user.id) {
      return NextResponse.json(
        { error: "只有任务发布者可以发布任务" },
        { status: 403 }
      );
    }

    // 检查任务是否已通过管理员审核
    if (!task.approved) {
      return NextResponse.json(
        { error: "任务尚未通过管理员审核，无法发布" },
        { status: 400 }
      );
    }

    // 检查任务状态是否为OPEN
    if (task.status !== "OPEN") {
      return NextResponse.json(
        { error: "只有开放中的任务可以发布" },
        { status: 400 }
      );
    }

    // 更新任务状态为IN_PROGRESS
    await db.annotationTask.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS",
      },
    });

    // 立即触发一次任务处理
    try {
      await processTaskById(taskId);
      console.log(`[Publish] ✅ 任务发布后自动触发处理成功: ${taskId}`);
    } catch (error) {
      console.error(`[Publish] ⚠️  任务发布后自动触发处理失败: ${taskId}`, error);
      // 不影响发布成功，只记录错误
    }

    return NextResponse.json({
      success: true,
      message: "任务已发布，状态更新为进行中",
    });
  } catch (error) {
    console.error("发布任务失败:", error);
    return NextResponse.json(
      { error: "发布任务失败，请稍后重试" },
      { status: 500 }
    );
  }
}
