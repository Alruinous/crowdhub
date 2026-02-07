import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  undoUserDayResults,
  undoSingleAnnotationResult,
  undoSingleReviewResult,
} from "@/lib/annotation-scheduler";

/**
 * 撤销接口：统一处理回滚
 * - 按天回滚：body 传 { userId, date }（date 格式 YYYY-MM-DD）
 * - 按条回滚标注：body 传 { userId, rowIndex } 或 { userId, rowIndex, round: 0 }
 * - 按条回滚复审：body 传 { userId, rowIndex, round: 1 }
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

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : undefined;

    if (!userId) {
      return NextResponse.json(
        { error: "请提供 userId（字符串）" },
        { status: 400 }
      );
    }

    // 非发布者/管理员：只能回滚自己的单条（userId=当前用户），且仅允许 rowIndex（标注 round:0 或复审 round:1）
    const roundParam = body.round;
    const round = roundParam === 1 ? 1 : 0;
    if (!isPublisherOrAdmin) {
      if (userId !== session.user.id) {
        return NextResponse.json(
          { error: "只能回滚自己的结果" },
          { status: 403 }
        );
      }
      const hasRowIndex =
        typeof body.rowIndex === "number" ||
        (typeof body.rowIndex === "string" && body.rowIndex !== "" && !Number.isNaN(parseInt(body.rowIndex, 10)));
      if (!hasRowIndex || body.date) {
        return NextResponse.json(
          { error: "仅支持按条目序号回滚单条（标注或复审）" },
          { status: 403 }
        );
      }
    }

    const date =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : undefined;
    const rowIndex =
      typeof body.rowIndex === "number"
        ? body.rowIndex
        : typeof body.rowIndex === "string"
          ? parseInt(body.rowIndex, 10)
          : undefined;

    //按日期回滚
    if (date) {
      const { undone, skippedSentToReview, skippedNotIncorrect } = await undoUserDayResults(taskId, userId, date);
      const parts = [`成功回滚 ${undone} 条`];
      if (skippedSentToReview > 0) parts.push(`${skippedSentToReview} 条已发放给复审无法回滚`);
      if (skippedNotIncorrect > 0) parts.push(`${skippedNotIncorrect} 条非错误未回滚`);
      const message = parts.join("，");
      return NextResponse.json({
        success: true,
        message,
        undone,
        skippedSentToReview,
        skippedNotIncorrect,
      });
    }

    //按条目序号回滚
    if (rowIndex != null && !Number.isNaN(rowIndex)) {
      if (round === 1) {
        const { undone } = await undoSingleReviewResult(
          taskId,
          rowIndex,
          userId
        );
        return NextResponse.json({
          success: true,
          message: "已回滚该复审员在指定条目的复审结果，可重新复审",
          undone,
        });
      }
      const result = await undoSingleAnnotationResult(
        taskId,
        rowIndex,
        userId
      );
      return NextResponse.json({
        success: true,
        message: result.message ?? "已回滚该标注者在指定条目的结果，可重新标注",
        undone: result.undone,
      });
    }

    return NextResponse.json(
      {
        error:
          "请提供 date（YYYY-MM-DD）按天回滚，或 rowIndex（数字）按条回滚",
      },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "回滚标注结果失败";
    console.error("回滚标注结果失败:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
