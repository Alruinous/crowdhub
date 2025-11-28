import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "未授权" }, { status: 401 })

    const { id: subtaskId } = await params
    const subtask = await db.annotationSubtask.findUnique({
      where: { id: subtaskId },
      include: { task: true },
    })
    if (!subtask) return NextResponse.json({ message: "子任务不存在" }, { status: 404 })
    const isPublisher = subtask.task.publisherId === session.user.id
    const isAdmin = session.user.role === "ADMIN"
    if (!isPublisher && !isAdmin) return NextResponse.json({ message: "无权限" }, { status: 403 })

    await db.$transaction(async (tx) => {
      await tx.annotation.updateMany({
        where: { subtaskId },
        data: { status: "REJECTED" },
      })
      await tx.annotationSubtask.update({
        where: { id: subtaskId },
        data: { status: "REJECTED" },
      })
    })

    return NextResponse.json({ message: "已标记为不通过" })
  } catch (error) {
    console.error("审核拒绝失败:", error)
    return NextResponse.json({ message: "审核拒绝失败" }, { status: 500 })
  }
}
