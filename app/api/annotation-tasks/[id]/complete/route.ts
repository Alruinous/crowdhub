// 提交标注任务完成：当所有认领标注者均已完成全部标注且均被打分后，发布者提交将任务置为已完成
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
    const task = await db.annotationTask.findUnique({
      where: { id },
      include: {
        workers: { select: { id: true } },
        scores: { select: { workerId: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "只有任务发布者可以提交完成任务" }, { status: 403 });
    }
    if (task.status === "COMPLETED") {
      return NextResponse.json({ error: "任务已完成，无需重复提交" }, { status: 400 });
    }
    if (task.workers.length === 0) {
      return NextResponse.json({ error: "当前没有认领该任务的标注者，无法提交" }, { status: 400 });
    }

    // 校验每位认领标注者均已打分
    const unscored = task.workers.filter(
      (w) => !task.scores.some((s) => s.workerId === w.id)
    );
    if (unscored.length > 0) {
      return NextResponse.json(
        { error: "还有标注者未被打分，无法提交整个任务" },
        { status: 400 }
      );
    }

    await db.annotationTask.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "任务已完成",
    });
  } catch (error) {
    console.error("提交标注任务完成失败:", error);
    return NextResponse.json(
      { error: "提交失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
