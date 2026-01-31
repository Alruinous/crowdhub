import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  undoUserDayResults,
  undoSingleAnnotationResult,
} from "@/lib/annotation-scheduler";

/**
 * 撤销接口：统一处理两种回滚
 * - 按天回滚：body 传 { userId, date }（date 格式 YYYY-MM-DD）
 * - 按条回滚：body 传 { userId, rowIndex }（rowIndex 为数字）
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

    // 标注者只能回滚自己的单条（userId 必须为当前用户，且仅允许 rowIndex）
    if (!isPublisherOrAdmin) {
      if (userId !== session.user.id) {
        return NextResponse.json(
          { error: "只能回滚自己的标注结果" },
          { status: 403 }
        );
      }
      const onlyRowIndex =
        typeof body.rowIndex === "number" ||
        (typeof body.rowIndex === "string" && body.rowIndex !== "" && !Number.isNaN(parseInt(body.rowIndex, 10)));
      if (!onlyRowIndex || body.date) {
        return NextResponse.json(
          { error: "标注者仅支持按条目序号回滚单条" },
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

    if (date) {
      const { undone } = await undoUserDayResults(taskId, userId, date);
      return NextResponse.json({
        success: true,
        message: `已回滚该用户 ${date} 发放的 ${undone} 条标注结果`,
        undone,
      });
    }

    if (rowIndex != null && !Number.isNaN(rowIndex)) {
      const { undone } = await undoSingleAnnotationResult(
        taskId,
        rowIndex,
        userId
      );
      return NextResponse.json({
        success: true,
        message: "已回滚该标注者在指定条目的结果，可重新标注",
        undone,
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
