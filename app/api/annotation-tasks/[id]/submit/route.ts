import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    const { id: taskId } = await params

    // 获取当前用户认领的子任务
    const subtasks = await db.annotationSubtask.findMany({
      where: {
        taskId,
        workerId: session.user.id,
      },
    })

    if (subtasks.length === 0) {
      return NextResponse.json(
        { message: "您未认领此任务的任何子任务" },
        { status: 400 }
      )
    }

    // 更新所有认领的子任务状态为 PENDING_REVIEW
    await db.annotationSubtask.updateMany({
      where: {
        taskId,
        workerId: session.user.id,
        status: {
          in: ["IN_PROGRESS", "CLAIMED"], // 只更新进行中或已认领的子任务
        },
      },
      data: {
        status: "PENDING_REVIEW",
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: "提交成功",
      subtaskCount: subtasks.length,
    })
  } catch (error) {
    console.error("提交标注失败:", error)
    return NextResponse.json(
      { message: "提交失败", error: String(error) },
      { status: 500 }
    )
  }
}
