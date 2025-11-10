import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

// 定义请求体的验证模式
const categoriesSchema = z.object({
  categories: z.array(z.string()).min(1, { message: "请至少选择一个擅长领域" }),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    // 验证用户身份
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ message: "未授权访问" }, { status: 401 });
    }

    // 确保用户只能更新自己的数据
    if (session.user.id !== userId) {
      return NextResponse.json(
        { message: "无权修改其他用户的信息" },
        { status: 403 }
      );
    }

    // 解析和验证请求体
    const body = await req.json();
    const { categories } = categoriesSchema.parse(body);

    // 先清除用户现有的categories关联
    await db.userCategory.deleteMany({
      where: {
        userId: userId,
      },
    });

    // 创建新的关联
    await db.$transaction(
      categories.map((categoryId) =>
        db.userCategory.create({
          data: {
            userId: userId,
            categoryId: categoryId,
          },
        })
      )
    );

    // 获取更新后的用户数据和关联的categories
    const updatedUser = await db.user.findUnique({
      where: { id: userId },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "擅长领域更新成功",
      categories: updatedUser?.categories.map((uc) => uc.category),
    });
  } catch (error) {
    console.error("更新用户擅长领域时出错:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "更新用户擅长领域失败" },
      { status: 500 }
    );
  }
}
