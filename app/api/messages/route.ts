import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"
import * as z from "zod"

const messageSchema = z.object({
  taskId: z.string(),
  content: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    const body = await req.json()
    const { taskId, content } = messageSchema.parse(body)

    // Get the task
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: {
          select: {
            workerId: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ message: "任务不存在" }, { status: 404 })
    }

    // Check if user is authorized to send messages
    const isPublisher = task.publisherId === session.user.id
    const isWorker = task.subtasks.some((subtask) => subtask.workerId === session.user.id)
    const isAdmin = session.user.role === "ADMIN"

    if (!isPublisher && !isWorker && !isAdmin) {
      return NextResponse.json({ message: "您无权在此任务中发送消息" }, { status: 403 })
    }

    // Create message
    const message = await db.message.create({
      data: {
        content,
        senderId: session.user.id,
        taskId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ message: "发送消息失败，请稍后再试" }, { status: 500 })
  }
}
