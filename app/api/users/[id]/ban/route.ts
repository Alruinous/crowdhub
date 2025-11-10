import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Only admins can ban users
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "只有管理员可以禁用用户" }, { status: 403 })
    }

    const userId = params.id

    // Check if user exists
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ message: "用户不存在" }, { status: 404 })
    }

    // Cannot ban admin users
    if (user.role === "ADMIN") {
      return NextResponse.json({ message: "无法禁用管理员账号" }, { status: 400 })
    }

    // Ban user
    const bannedUser = await db.user.update({
      where: { id: userId },
      data: { banned: true },
    })

    return NextResponse.json({ message: "用户已禁用" })
  } catch (error) {
    return NextResponse.json({ message: "禁用用户失败，请稍后再试" }, { status: 500 })
  }
}
