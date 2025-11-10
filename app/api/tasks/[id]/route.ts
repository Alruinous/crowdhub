import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 });
    }

    const taskId = params.id;

    // Get the task
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { publisherId: true },
    });

    if (!task) {
      return NextResponse.json({ message: "任务不存在" }, { status: 404 });
    }

    // Check if user is authorized to delete the task
    const isPublisher = task.publisherId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isPublisher && !isAdmin) {
      return NextResponse.json({ message: "无权删除此任务" }, { status: 403 });
    }

    // Delete the task (cascades to subtasks and messages)
    await db.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ message: "任务已删除" });
  } catch (error) {
    return NextResponse.json(
      { message: "删除任务失败，请稍后再试" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 });
    }

    // 确保参数已解析
    const { id } = params;
    const taskId = id;
    const body = await req.json();

    // 获取任务
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: { publisherId: true },
    });

    if (!task) {
      return NextResponse.json({ message: "任务不存在" }, { status: 404 });
    }

    // 检查用户是否有权限更新任务
    const isPublisher = task.publisherId === session.user.id;
    const isAdmin = session.user.role === "ADMIN";

    if (!isPublisher && !isAdmin) {
      return NextResponse.json({ message: "无权更新此任务" }, { status: 403 });
    }

    // 处理请求数据，正确格式化 subtasks
    const { subtasks, ...taskData } = body;

    const updateData = {
      ...taskData,
      // 如果存在 subtasks，以 Prisma 期望的格式提供
      ...(subtasks
        ? {
            subtasks: {
              deleteMany: {}, // 先删除原有的子任务
              create: subtasks, // 创建新的子任务
            },
          }
        : {}),
    };

    // 更新任务
    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        subtasks: true, // 在响应中包含更新后的子任务
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("更新任务失败:", error);
    return NextResponse.json(
      { message: "更新任务失败，请稍后再试" },
      { status: 500 }
    );
  }
}
