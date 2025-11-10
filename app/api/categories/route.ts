import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import * as z from "zod"

const categorySchema = z.object({
  name: z.string().min(2),
})

export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(categories)
  } catch (error) {
    return NextResponse.json(
      { message: "获取分类失败，请稍后再试" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Only admins can create categories
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "只有管理员可以创建分类" }, { status: 403 })
    }

    const body = await req.json()
    const { name } = categorySchema.parse(body)

    // Check if category already exists
    const existingCategory = await db.category.findUnique({
      where: { name },
    })

    if (existingCategory) {
      return NextResponse.json({ message: "分类名称已存在" }, { status: 409 })
    }

    // Create category
    const category = await db.category.create({
      data: { name },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ message: "创建分类失败，请稍后再试" }, { status: 500 })
  }
}
