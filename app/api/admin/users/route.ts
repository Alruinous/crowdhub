import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "PUBLISHER", "WORKER"]),
  categories: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    // 验证请求者是否为管理员
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "未授权" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role, categories } = userSchema.parse(body);

    // 检查邮箱是否已被使用
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ message: "邮箱已被注册" }, { status: 409 });
    }

    const hashedPassword = await hash(password, 10);

    // 创建用户并处理分类关系
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        // 如果是 WORKER 角色并且选择了分类，创建关联
        ...(role === "WORKER" && categories && categories.length > 0
          ? {
              categories: {
                create: categories.map((categoryId) => ({
                  category: {
                    connect: {
                      id: categoryId,
                    },
                  },
                })),
              },
            }
          : {}),
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    // 移除密码后返回用户信息
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("创建用户错误:", error);
    return NextResponse.json(
      { message: "创建用户失败，请稍后再试" },
      { status: 500 }
    );
  }
}
