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

    // Only admins can approve annotation tasks
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "只有管理员可以审批标注任务" }, { status: 403 })
    }

    const taskId = params.id

    // Update annotation task to approved
    const task = await db.annotationTask.update({
      where: { id: taskId },
      data: { approved: true },
    })

    return NextResponse.json(task)
  } catch (error) {
    return NextResponse.json({ message: "审批标注任务失败，请稍后再试" }, { status: 500 })
  }
}
