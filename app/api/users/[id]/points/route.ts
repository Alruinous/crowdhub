import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as z from "zod";

// 验证请求数据的 schema
const pointsSchema = z.object({
  points: z.number().int().positive(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await req.json();

    // 验证输入数据
    const { points } = pointsSchema.parse(body);

    // 查找用户
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ message: "用户不存在" }, { status: 404 });
    }

    // 更新用户积分
    // 假设 User 模型中有一个 points 字段，如果没有需要先在数据库迁移中添加
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        points: {
          increment: points,
        },
      },
      select: {
        id: true,
        points: true,
      },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    console.error("充值积分错误:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "积分充值失败，请稍后再试" },
      { status: 500 }
    );
  }
}
