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

    // Only workers can claim subtasks
    if (session.user.role !== "WORKER") {
      return NextResponse.json({ message: "只有接单者可以认领任务" }, { status: 403 })
    }

    const subtaskId = params.id

    // Get the subtask
    const subtask = await db.subtask.findUnique({
      where: { id: subtaskId },
      include: {
        task: {
          include: {
            subtasks: {
              where: {
                workerId: session.user.id,
              },
            },
          },
        },
      },
    })

    if (!subtask) {
      return NextResponse.json({ message: "子任务不存在" }, { status: 404 })
    }

    // Check if subtask is already claimed
    if (subtask.workerId) {
      return NextResponse.json({ message: "此子任务已被认领" }, { status: 400 })
    }

    // Check if task is approved
    if (!subtask.task.approved) {
      return NextResponse.json({ message: "此任务尚未审批，无法认领" }, { status: 400 })
    }

    // Check if task is open
    if (subtask.task.status !== "OPEN") {
      return NextResponse.json({ message: "此任务不在招募中状态，无法认领" }, { status: 400 })
    }


    // Count workers in this task
    const workerCount = await db.subtask.count({
      where: {
        taskId: subtask.taskId,
        NOT: {
          workerId: null,
        },
      },
    })

    // Check if task has reached max workers
    if (workerCount >= subtask.task.maxWorkers) {
      return NextResponse.json({ message: "此任务已达到最大接单人数" }, { status: 400 })
    }

    // Update subtask with worker and status
    const updatedSubtask = await db.subtask.update({
      where: { id: subtaskId },
      data: {
        workerId: session.user.id,
        status: "IN_PROGRESS",
      },
    })

    // Check if task should be updated to IN_PROGRESS
    if (workerCount + 1 >= subtask.task.maxWorkers) {
      await db.task.update({
        where: { id: subtask.taskId },
        data: { status: "IN_PROGRESS" },
      })
    }

    return NextResponse.json(updatedSubtask)
  } catch (error) {
    return NextResponse.json({ message: "认领子任务失败，请稍后再试" }, { status: 500 })
  }
}
