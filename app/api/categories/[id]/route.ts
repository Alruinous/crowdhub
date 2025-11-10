import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import * as z from "zod"

const categorySchema = z.object({
  name: z.string().min(2),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Only admins can update categories
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "只有管理员可以更新分类" }, { status: 403 })
    }

    const categoryId = params.id
    const body = await req.json()
    const { name } = categorySchema.parse(body)

    // Check if category exists
    const category = await db.category.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return NextResponse.json({ message: "分类不存在" }, { status: 404 })
    }

    // Check if name is already used by another category
    const existingCategory = await db.category.findFirst({
      where: {
        name,
        NOT: {
          id: categoryId,
        },
      },
    })

    if (existingCategory) {
      return NextResponse.json({ message: "分类名称已存在" }, { status: 409 })
    }

    // Update category
    const updatedCategory = await db.category.update({
      where: { id: categoryId },
      data: { name },
    })

    return NextResponse.json(updatedCategory)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ message: "更新分类失败，请稍后再试" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Only admins can delete categories
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "只有管理员可以删除分类" }, { status: 403 })
    }

    const categoryId = params.id

    // Check if category exists
    const category = await db.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    })

    if (!category) {
      return NextResponse.json({ message: "分类不存在" }, { status: 404 })
    }

    // Check if category has tasks
    if (category._count.tasks > 0) {
      return NextResponse.json({ message: "无法删除有关联任务的分类" }, { status: 400 })
    }

    // Delete category
    await db.category.delete({
      where: { id: categoryId },
    })

    return NextResponse.json({ message: "分类已删除" })
  } catch (error) {
    return NextResponse.json({ message: "删除分类失败，请稍后再试" }, { status: 500 })
  }
}
