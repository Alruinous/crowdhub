import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "只有管理员可以审批日常任务" }, { status: 403 });
    }

    const { id } = await params;
    const task = await db.normalTask.findUnique({
      where: { id },
      select: { id: true, status: true, approved: true },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (task.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "只有已提交发布的任务可以审批" }, { status: 400 });
    }
    if (task.approved) {
      return NextResponse.json({ error: "任务已经审批通过" }, { status: 400 });
    }

    const approvedTask = await db.normalTask.update({
      where: { id },
      data: { approved: true },
    });

    return NextResponse.json(approvedTask);
  } catch (error) {
    console.error("审批日常任务失败:", error);
    return NextResponse.json({ error: "审批日常任务失败，请稍后再试" }, { status: 500 });
  }
}
