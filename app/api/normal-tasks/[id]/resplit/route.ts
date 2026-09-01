// 重新拆解日常任务的子任务（仅发布者，发布前可用）：删除旧子任务并调用 AI 重新生成
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { splitNormalTaskWithAI } from "@/lib/ai-task-split";

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
      select: { id: true, title: true, description: true, points: true, status: true, publisherId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (task.publisherId !== session.user.id) {
      return NextResponse.json({ error: "只有任务发布者可以重新拆分子任务" }, { status: 403 });
    }
    if (task.status !== "OPEN") {
      return NextResponse.json({ error: "只有发布前的日常任务可以重新拆分子任务" }, { status: 400 });
    }

    let subtasks;
    try {
      subtasks = await splitNormalTaskWithAI({
        title: task.title,
        description: task.description,
        points: task.points,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "AI 重新拆解失败" },
        { status: 500 }
      );
    }

    // 事务：删除旧子任务 + 创建新子任务
    await db.$transaction([
      db.normalSubtask.deleteMany({ where: { taskId: id } }),
      db.normalSubtask.createMany({
        data: subtasks.map((s) => ({
          title: s.title,
          description: s.description,
          points: s.points,
          taskId: id,
        })),
      }),
    ]);

    return NextResponse.json({
      success: true,
      count: subtasks.length,
      message: `已重新拆分为 ${subtasks.length} 个子任务`,
    });
  } catch (error) {
    console.error("重新拆解日常任务失败:", error);
    return NextResponse.json(
      { error: "重新拆解失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
