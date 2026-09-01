// 发布者给标注任务中的标注者打分（每人每任务一次，积分汇入标注者账户）

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

    // 获取请求体中的 workerId 与 score
    const body = await req.json().catch(() => ({}));
    const { workerId, score } = body as { workerId?: string; score?: number };

    if (!workerId || typeof score !== "number" || !Number.isInteger(score)) {
      return NextResponse.json(
        { error: "参数错误：workerId 与整数打分 score（1-10）为必填" },
        { status: 400 }
      );
    }

    // 获取任务（含认领者 workers）
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        workers: {
          select: { id: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // 仅发布者可打分（管理员的打分需求不在本需求范围内）
    if (task.publisherId !== session.user.id) {
      return NextResponse.json(
        { error: "只有任务发布者可以给标注者打分" },
        { status: 403 }
      );
    }

    // 校验被评分者确实认领了该任务（是标注者，而非复审员）
    const workerExists = task.workers.some((w) => w.id === workerId);
    if (!workerExists) {
      return NextResponse.json(
        { error: "该用户不是本任务的认领标注者" },
        { status: 400 }
      );
    }

    // 校验该标注者尚未被打分（每人每任务一次）
    const existing = await db.annotationTaskScore.findUnique({
      where: {
        taskId_workerId: {
          taskId,
          workerId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "该标注者已被打分，无法重复评分" },
        { status: 400 }
      );
    }

    // 计算打分上限：四舍五入（Math.round(总积分 ÷ 当前认领人数)）
    const workerCount = task.workers.length;
    if (workerCount === 0) {
      return NextResponse.json(
        { error: "当前无认领该任务的标注者" },
        { status: 400 }
      );
    }
    const maxScore = Math.round(task.points / workerCount);

    if (maxScore < 1) {
      return NextResponse.json(
        { error: "当前认领人数过多，单个标注者可获积分上限不足1，无法打分" },
        { status: 400 }
      );
    }

    // 打分范围为 1-10
    if (score < 1 || score > 10) {
      return NextResponse.json(
        { error: "打分必须是不小于1且不超过10的整数" },
        { status: 400 }
      );
    }

    // 真实得分 = 单人打分上限 × 打分 / 10，四舍五入取整
    const realScore = Math.round((maxScore * score) / 10);

    // 事务：创建打分记录（真实得分）+ 积分汇入标注者账户
    await db.$transaction([
      db.annotationTaskScore.create({
        data: {
          taskId,
          workerId,
          scoredById: session.user.id,
          score: realScore,
        },
      }),
      db.user.update({
        where: { id: workerId },
        data: {
          points: {
            increment: realScore,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "打分成功，积分已汇入标注者账户",
    });
  } catch (error) {
    console.error("给标注者打分失败:", error);
    return NextResponse.json(
      { error: "打分失败，请稍后重试" },
      { status: 500 }
    );
  }
}
