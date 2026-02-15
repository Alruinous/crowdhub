import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { distributeNeedToReview2ToReviewers } from "@/lib/annotation-scheduler";

/**
 * 手动触发二级复审任务下发：将 needToReview2 且尚未分配 round=2 的条目发放给二级复审员
 * 仅任务发布者或管理员可调用
 */
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
        { error: "只有任务发布者或管理员可下发二级复审任务" },
        { status: 403 }
      );
    }

    const distributed = await distributeNeedToReview2ToReviewers(taskId);

    return NextResponse.json({
      success: true,
      message:
        distributed > 0
          ? `已下发 ${distributed} 条需二级复审条目给二级复审员`
          : "暂无待下发的需二级复审条目",
      distributed,
    });
  } catch (error) {
    console.error("下发二级复审任务失败:", error);
    return NextResponse.json(
      { error: "下发二级复审任务失败，请稍后重试" },
      { status: 500 }
    );
  }
}
