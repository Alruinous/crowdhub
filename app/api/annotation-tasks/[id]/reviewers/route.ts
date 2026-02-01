import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const LEVEL_L1 = 1;

/**
 * 添加一级复审员：POST body { userId, level: 1 }
 * 移除复审员：DELETE body { userId, level: 1 }
 * 仅任务发布者或管理员可操作。
 */
export async function POST(
  req: Request,
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
        { error: "只有任务发布者或管理员可添加复审员" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : undefined;
    const level = body.level === LEVEL_L1 ? LEVEL_L1 : undefined;

    if (!userId || level === undefined) {
      return NextResponse.json(
        { error: "请提供 userId 和 level（一级复审员为 1）" },
        { status: 400 }
      );
    }

    const existing = await db.annotationTaskReviewer.findUnique({
      where: {
        taskId_userId_level: { taskId, userId, level },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "该用户已是本任务的一级复审员" },
        { status: 400 }
      );
    }

    await db.annotationTaskReviewer.create({
      data: { taskId, userId, level },
    });

    return NextResponse.json({
      success: true,
      message: "已添加一级复审员",
    });
  } catch (error) {
    console.error("添加复审员失败:", error);
    return NextResponse.json(
      { error: "添加复审员失败，请稍后重试" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
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
        { error: "只有任务发布者或管理员可移除复审员" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : undefined;
    const level = body.level === LEVEL_L1 ? LEVEL_L1 : undefined;

    if (!userId || level === undefined) {
      return NextResponse.json(
        { error: "请提供 userId 和 level" },
        { status: 400 }
      );
    }

    await db.annotationTaskReviewer.deleteMany({
      where: { taskId, userId, level },
    });

    return NextResponse.json({
      success: true,
      message: "已移除复审员",
    });
  } catch (error) {
    console.error("移除复审员失败:", error);
    return NextResponse.json(
      { error: "移除复审员失败，请稍后重试" },
      { status: 500 }
    );
  }
}
