// 发布者对日常任务某子任务打分（仅发布者，每子任务一次）
// 上限 = 该子任务价值分数；真实得分 = round(上限 × 打分/10)；积分发放给该子任务的认领人
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

    const taskId = (await params).id;
    const body = await request.json().catch(() => ({}));
    const { subtaskId, score } = body as { subtaskId?: string; score?: number };

    const task = await db.normalTask.findUnique({
      where: { id: taskId },
      include: {
        subtasks: { select: { id: true, points: true, workerId: true } },
        scores: { select: { subtaskId: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (task.publisherId !== session.user.id) {
      return NextResponse.json({ error: "只有任务发布者可以打分" }, { status: 403 });
    }

    if (!subtaskId) {
      return NextResponse.json({ error: "缺少 subtaskId" }, { status: 400 });
    }

    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) {
      return NextResponse.json({ error: "子任务不存在" }, { status: 404 });
    }
    if (!subtask.workerId) {
      return NextResponse.json({ error: "该子任务尚未被认领，无法打分" }, { status: 400 });
    }
    // 每子任务只能打一次
    if (task.scores.some((s) => s.subtaskId === subtaskId)) {
      return NextResponse.json({ error: "该子任务已被评分，无法重复打分" }, { status: 400 });
    }

    const n = Number(score);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      return NextResponse.json({ error: "打分必须为 1~10 的整数" }, { status: 400 });
    }

    const cap = subtask.points; // 上限 = 该子任务价值分数
    const realScore = Math.round((cap * n) / 10);

    // 事务：创建打分记录 + 将子任务置为已确认(COMPLETED) + 发放积分到认领该子任务的 worker 账户
    await db.$transaction([
      db.normalTaskScore.create({
        data: {
          taskId,
          subtaskId,
          workerId: subtask.workerId,
          scoredById: session.user.id,
          score: realScore,
        },
      }),
      db.normalSubtask.update({
        where: { id: subtaskId },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
      db.user.update({
        where: { id: subtask.workerId },
        data: { points: { increment: realScore } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `真实得分：上限 ${cap} × ${n}/10 = ${realScore} 积分`,
      score: realScore,
      cap,
    });
  } catch (error) {
    console.error("日常任务打分失败:", error);
    return NextResponse.json({ error: "打分失败，请稍后重试" }, { status: 500 });
  }
}
