// 发布日常任务：仅将状态置为 IN_PROGRESS（子任务已在创建时由 AI 拆解，发布不重新拆分）
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
    if (task.publisherId !== session.user.id) {
      return NextResponse.json({ error: "只有任务发布者可以发布" }, { status: 403 });
    }
    if (task.status !== "OPEN") {
      return NextResponse.json({ error: "只有未发布的日常任务可以发布" }, { status: 400 });
    }

    // 发布前需已有 AI 拆解的子任务
    const subtaskCount = await db.normalSubtask.count({ where: { taskId: id } });
    if (subtaskCount === 0) {
      return NextResponse.json(
        { error: "任务还没有子任务，请先重新拆分子任务" },
        { status: 400 }
      );
    }

    await db.normalTask.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json({
      success: true,
      message: "已发布，任务进入进行中",
    });
  } catch (error) {
    console.error("发布日常任务失败:", error);
    return NextResponse.json(
      { error: "发布日常任务失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
