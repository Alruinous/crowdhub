import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import * as z from "zod";

// 定义请求体验证schema
const taskTypeSchema = z.object({
  name: z.string().min(1, { message: "任务类型名称不能为空" }),
});

interface RouteContextProps {
  params: {
    id: string;
  };
}

// PATCH处理器 - 更新任务类型
export async function PATCH(req: Request, context: RouteContextProps) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "未授权访问" }, { status: 403 });
    }

    const { id } = context.params;
    const json = await req.json();
    const body = taskTypeSchema.parse(json);

    // 检查要更新的任务类型是否存在
    const taskType = await db.taskType.findUnique({
      where: {
        id,
      },
    });

    if (!taskType) {
      return NextResponse.json({ message: "任务类型不存在" }, { status: 404 });
    }

    // 检查是否存在同名任务类型（排除当前任务类型）
    const existingTaskType = await db.taskType.findFirst({
      where: {
        name: body.name,
        id: {
          not: id,
        },
      },
    });

    if (existingTaskType) {
      return NextResponse.json(
        { message: "该任务类型名称已存在" },
        { status: 400 }
      );
    }

    // 更新任务类型
    const updatedTaskType = await db.taskType.update({
      where: {
        id,
      },
      data: {
        name: body.name,
      },
    });

    return NextResponse.json(updatedTaskType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "更新任务类型失败" }, { status: 500 });
  }
}

// DELETE处理器 - 删除任务类型
export async function DELETE(req: Request, context: RouteContextProps) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "未授权访问" }, { status: 403 });
    }

    const { id } = context.params;

    // 检查要删除的任务类型是否存在
    const taskType = await db.taskType.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!taskType) {
      return NextResponse.json({ message: "任务类型不存在" }, { status: 404 });
    }

    // 检查是否有关联的任务
    if (taskType._count.tasks > 0) {
      return NextResponse.json(
        { message: "该任务类型下有关联的任务，无法删除" },
        { status: 400 }
      );
    }

    // 删除任务类型
    await db.taskType.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ message: "任务类型已成功删除" });
  } catch (error) {
    return NextResponse.json({ message: "删除任务类型失败" }, { status: 500 });
  }
}
