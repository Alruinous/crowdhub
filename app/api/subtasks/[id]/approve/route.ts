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

    const subtaskId = params.id

    // Get the subtask with task and publisher
    const subtask = await db.subtask.findUnique({
      where: { id: subtaskId },
      include: {
        task: {
          select: {
            publisherId: true,
            id: true,
          },
        },
      },
    })

    if (!subtask) {
      return NextResponse.json({ message: "子任务不存在" }, { status: 404 })
    }

    // Check if user is the publisher of the task
    if (subtask.task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ message: "只有任务发布者可以确认完成" }, { status: 403 })
    }

    // Check if subtask is pending approval
    if (subtask.status !== "PENDING_APPROVAL") {
      return NextResponse.json({ message: "只有待确认的子任务可以确认完成" }, { status: 400 })
    }

    // Start a transaction to update subtask and transfer points
    const result = await db.$transaction(async (tx) => {
      // Update subtask status to completed
      const updatedSubtask = await tx.subtask.update({
        where: { id: subtaskId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      })

      // Transfer points to worker
      if (subtask.workerId) {
        await tx.user.update({
          where: { id: subtask.workerId },
          data: {
            points: {
              increment: subtask.points,
            },
          },
        })

        // Deduct points from publisher
        await tx.user.update({
          where: { id: subtask.task.publisherId },
          data: {
            points: {
              decrement: subtask.points,
            },
          },
        })
      }

      // Check if all subtasks are completed
      const remainingSubtasks = await tx.subtask.count({
        where: {
          taskId: subtask.task.id,
          status: {
            not: "COMPLETED",
          },
        },
      })

      // If all subtasks are completed, mark task as completed
      if (remainingSubtasks === 0) {
        await tx.task.update({
          where: { id: subtask.task.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        })
      }

      return updatedSubtask
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ message: "确认完成失败，请稍后再试" }, { status: 500 })
  }
}
