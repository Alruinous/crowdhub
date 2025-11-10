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

    // Get the subtask
    const subtask = await db.subtask.findUnique({
      where: { id: subtaskId },
    })

    if (!subtask) {
      return NextResponse.json({ message: "子任务不存在" }, { status: 404 })
    }

    // Check if user is the worker of this subtask
    if (subtask.workerId !== session.user.id) {
      return NextResponse.json({ message: "只有认领此子任务的接单者可以标记完成" }, { status: 403 })
    }

    // Check if subtask is in progress
    if (subtask.status !== "IN_PROGRESS") {
      return NextResponse.json({ message: "只有进行中的子任务可以标记完成" }, { status: 400 })
    }

    // Update subtask status to pending approval
    const updatedSubtask = await db.subtask.update({
      where: { id: subtaskId },
      data: {
        status: "PENDING_APPROVAL",
      },
    })

    return NextResponse.json(updatedSubtask)
  } catch (error) {
    return NextResponse.json({ message: "标记完成失败，请稍后再试" }, { status: 500 })
  }
}
