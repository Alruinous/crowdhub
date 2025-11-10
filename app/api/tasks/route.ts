import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import * as z from "zod";

const taskSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  categoryId: z.string(),
  typeId: z.string(), // 添加typeId字段验证
  points: z.number().min(1),
  maxWorkers: z.number().min(1),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(3),
        description: z.string().min(5),
        points: z.number().min(0),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 });
    }

    // Only publishers can create tasks
    if (session.user.role !== "PUBLISHER") {
      return NextResponse.json(
        { message: "只有发布者可以创建任务" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      categoryId,
      typeId,
      points,
      maxWorkers,
      subtasks,
    } = taskSchema.parse(body);

    // Create task with subtasks
    const task = await db.task.create({
      data: {
        title,
        description,
        points,
        maxWorkers,
        publisherId: session.user.id,
        categoryId,
        typeId, // 添加typeId字段到数据库创建操作
        subtasks: {
          create: subtasks.map((subtask) => ({
            title: subtask.title,
            description: subtask.description,
            points: subtask.points,
          })),
        },
      },
      include: {
        subtasks: true,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "创建任务失败，请稍后再试" },
      { status: 500 }
    );
  }
}
