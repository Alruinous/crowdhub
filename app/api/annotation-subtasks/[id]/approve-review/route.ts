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

    const body = await req.json().catch(() => ({})) as { points?: number }

    await db.$transaction(async (tx) => {
      // 不再强制将所有行设为 APPROVED，保留之前的单条审核结果（APPROVED / REJECTED）
      // 仅将仍处于 PENDING 的行自动设为 APPROVED（理论上提交前已全部处理，不应该存在）
      await tx.annotation.updateMany({
        where: { subtaskId, status: "PENDING" },
        data: { status: "APPROVED" },
      })

      const updatedSubtask = await tx.annotationSubtask.update({
        where: { id: subtaskId },
        data: { status: "COMPLETED", completedAt: new Date() },
      })

      const creditPoints = typeof body.points === "number" && body.points >= 0 ? body.points : (updatedSubtask.points ?? 0)
      if (creditPoints > 0 && updatedSubtask.workerId) {
        await tx.user.update({
          where: { id: updatedSubtask.workerId },
          data: { points: { increment: creditPoints } },
        })
      }

      // 检查该任务的所有子任务是否都已完成
      const remainingSubtasks = await tx.annotationSubtask.count({
        where: {
          taskId: updatedSubtask.taskId,
          status: {
            not: "COMPLETED",
          },
        },
      })

      // 如果所有子任务都已完成，将任务状态更新为已完成
      if (remainingSubtasks === 0) {
        await tx.annotationTask.update({
          where: { id: updatedSubtask.taskId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        })
      }
    })

    return NextResponse.json({ message: "提交成功，子任务已完成，保留逐条审核结果" })
  } catch (error) {
    console.error("审核通过失败:", error)
    return NextResponse.json({ message: "审核通过失败" }, { status: 500 })
  }
}
