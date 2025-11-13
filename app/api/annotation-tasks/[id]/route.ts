import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params

    // 从数据库获取任务信息
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!task) {
      return NextResponse.json(
        { error: "任务不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error("获取任务信息失败:", error)
    return NextResponse.json(
      { error: "获取任务信息失败" },
      { status: 500 }
    )
  }
}
