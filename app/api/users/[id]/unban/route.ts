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

    // Only admins can unban users
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "只有管理员可以启用用户" }, { status: 403 })
    }

    const userId = params.id

    // Check if user exists
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ message: "用户不存在" }, { status: 404 })
    }

    // Unban user
    const unbannedUser = await db.user.update({
      where: { id: userId },
      data: { banned: false },
    })

    return NextResponse.json({ message: "用户已启用" })
  } catch (error) {
    return NextResponse.json({ message: "启用用户失败，请稍后再试" }, { status: 500 })
  }
}
