// 完成任务：当所有子任务均已完成（COMPLETED）时，发布者提交将整个任务标记为已完成
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const id = (await params).id;
    const task = await db.normalTask.findUnique({
      where: { id },
      select: { id: true, status: true, publisherId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "只有任务发布者可以完成任务" }, { status: 403 });
    }
    if (task.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "只有进行中的日常任务可以标记完成" }, { status: 400 });
    }

    // 校验所有子任务均已完成
    const subtasks = await db.normalSubtask.findMany({
      where: { taskId: id },
      select: { status: true },
    });
    if (subtasks.length === 0 || subtasks.some((s) => s.status !== "COMPLETED")) {
      return NextResponse.json(
        { error: "还有子任务未完成，暂不能提交整个任务" },
        { status: 400 }
      );
    }

    await db.normalTask.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "任务已完成",
    });
  } catch (error) {
    console.error("完成任务失败:", error);
    return NextResponse.json(
      { error: "完成任务失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
