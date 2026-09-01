// 日常任务详情 / 删除
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = (await params).id;
    const task = await db.normalTask.findUnique({
      where: { id },
      include: {
        publisher: { select: { id: true, name: true } },
        subtasks: {
          orderBy: { createdAt: "asc" },
          include: {
            worker: { select: { id: true, name: true } },
          },
        },
        scores: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("获取日常任务失败:", error);
    return NextResponse.json({ error: "获取日常任务失败" }, { status: 500 });
  }
}

export async function DELETE(
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
      select: { publisherId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // 仅发布者或管理员可删除
    if (task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "只有任务发布者可以删除" }, { status: 403 });
    }

    await db.normalTask.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除日常任务失败:", error);
    return NextResponse.json({ error: "删除日常任务失败" }, { status: 500 });
  }
}
