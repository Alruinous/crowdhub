import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subtaskId } = await params

    // 从数据库获取子任务信息
    const subtask = await db.annotationSubtask.findUnique({
      where: { id: subtaskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        points: true,
        workerId: true,
        startRow: true,
        endRow: true,
        rowCount: true,
        createdAt: true,
        updatedAt: true,
        taskId: true,
      }
    })

    if (!subtask) {
      return NextResponse.json(
        { error: "子任务不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json(subtask)
  } catch (error) {
    console.error("获取子任务信息失败:", error)
    return NextResponse.json(
      { error: "获取子任务信息失败" },
      { status: 500 }
    )
  }
}
