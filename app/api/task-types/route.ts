import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import * as z from "zod";

// 定义请求体验证schema
const taskTypeSchema = z.object({
  name: z.string().min(1, { message: "任务类型名称不能为空" }),
});

// GET处理器 - 获取所有任务类型
export async function GET() {
  try {
    const taskTypes = await db.taskType.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    return NextResponse.json(taskTypes);
  } catch (error) {
    return NextResponse.json(
      { message: "获取任务类型列表失败" },
      { status: 500 }
    );
  }
}

// POST处理器 - 创建新任务类型
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "未授权访问" }, { status: 403 });
    }

    const json = await req.json();
    const body = taskTypeSchema.parse(json);

    // 检查是否已存在同名任务类型
    const existingTaskType = await db.taskType.findUnique({
      where: {
        name: body.name,
      },
    });

    if (existingTaskType) {
      return NextResponse.json(
        { message: "该任务类型名称已存在" },
        { status: 400 }
      );
    }

    // 创建新任务类型
    const taskType = await db.taskType.create({
      data: {
        name: body.name,
      },
    });

    return NextResponse.json(taskType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "创建任务类型失败" }, { status: 500 });
  }
}
