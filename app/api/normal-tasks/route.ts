// 创建日常任务（仅发布者），创建后自动调用 AI 拆解子任务
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { splitNormalTaskWithAI, AiSubtask } from "@/lib/ai-task-split";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
    if (session.user.role !== "PUBLISHER") {
      return NextResponse.json({ error: "只有发布者可以创建日常任务" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, points } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "缺少任务标题" }, { status: 400 });
    }
    if (!description || !String(description).trim()) {
      return NextResponse.json({ error: "缺少任务描述" }, { status: 400 });
    }
    if (typeof points !== "number" || !Number.isInteger(points) || points < 1) {
      return NextResponse.json({ error: "总积分必须是不小于1的整数" }, { status: 400 });
    }

    const task = await db.normalTask.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        points,
        status: "OPEN",
        publisherId: session.user.id,
      },
    });

    // 创建时自动调用 AI 拆解任务（失败不影响任务创建，可稍后在详情页重新拆分）
    let subtasks: AiSubtask[] = [];
    let aiError: string | undefined;
    try {
      subtasks = await splitNormalTaskWithAI({
        title: task.title,
        description: task.description,
        points: task.points,
      });
      await db.normalSubtask.createMany({
        data: subtasks.map((s) => ({
          title: s.title,
          description: s.description,
          points: s.points,
          taskId: task.id,
        })),
      });
    } catch (error) {
      aiError = error instanceof Error ? error.message : "AI 拆解任务失败";
    }

    return NextResponse.json({
      success: true,
      task,
      subtaskCount: subtasks.length,
      aiError,
    });
  } catch (error) {
    console.error("创建日常任务失败:", error);
    return NextResponse.json(
      { error: "创建日常任务失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
