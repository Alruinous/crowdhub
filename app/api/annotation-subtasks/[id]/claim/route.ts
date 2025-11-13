import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    console.log("entered claim route")

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    // Only workers can claim annotation subtasks
    if (session.user.role !== "WORKER") {
      return NextResponse.json({ message: "只有接单者可以认领标注任务" }, { status: 403 })
    }

    const { id: subtaskId } = await params

    // Get the annotation subtask
    const subtask = await db.annotationSubtask.findUnique({
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
      return NextResponse.json({ message: "标注子任务不存在" }, { status: 404 })
    }

    // Check if subtask is already claimed
    if (subtask.workerId) {
      return NextResponse.json({ message: "此标注子任务已被认领" }, { status: 400 })
    }

    // Check if annotation task is approved
    if (!subtask.task.approved) {
      return NextResponse.json({ message: "此标注任务尚未审批，无法认领" }, { status: 400 })
    }

    // Check if annotation task is open
    if (subtask.task.status !== "OPEN") {
      return NextResponse.json({ message: "此标注任务不在招募中状态，无法认领" }, { status: 400 })
    }


    // Count workers in this annotation task
    const workerCount = await db.annotationSubtask.count({
      where: {
        taskId: subtask.taskId,
        NOT: {
          workerId: null,
        },
      },
    })

    // Check if annotation task has reached max workers
    if (workerCount >= subtask.task.maxWorkers) {
      return NextResponse.json({ message: "此标注任务已达到最大接单人数" }, { status: 400 })
    }

    // Update annotation subtask with worker and status
    const updatedSubtask = await db.annotationSubtask.update({
      where: { id: subtaskId },
      data: {
        workerId: session.user.id,
        status: "IN_PROGRESS",
      },
    })

    // Check if annotation task should be updated to IN_PROGRESS
    if (workerCount + 1 >= subtask.task.maxWorkers) {
      await db.annotationTask.update({
        where: { id: subtask.taskId },
        data: { status: "IN_PROGRESS" },
      })
    }

    return NextResponse.json(updatedSubtask)
  } catch (error) {
    return NextResponse.json({ message: "认领标注子任务失败，请稍后再试" }, { status: 500 })
  }
}
