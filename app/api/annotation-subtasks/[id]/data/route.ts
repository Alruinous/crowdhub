import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    const { id: subtaskId } = await params

    // 验证子任务是否存在且属于当前用户
    const subtask = await db.annotationSubtask.findUnique({
      where: { id: subtaskId },
      include: {
        task: {
          include: {
            dataFile: true,
          },
        },
      },
    })

    if (!subtask) {
      return NextResponse.json({ message: "标注子任务不存在" }, { status: 404 })
    }

    // 验证访问权限：接单者或发布者或管理员
    const isWorker = subtask.workerId === session.user.id
    const isPublisher = subtask.task.publisherId === session.user.id
    const isAdmin = session.user.role === "ADMIN"
    if (!isWorker && !isPublisher && !isAdmin) {
      return NextResponse.json({ message: "您没有权限访问此子任务的数据" }, { status: 403 })
    }

    // 获取数据文件内容
    if (!subtask.task.dataFile) {
      return NextResponse.json({ message: "此任务没有数据文件" }, { status: 404 })
    }

    // 从数据文件中提取子任务对应的数据行
    const dataFile = subtask.task.dataFile
    const allData = dataFile.data as any[] || []
    
    // 根据子任务的起始行和结束行提取数据
    const startRow = subtask.startRow || 0
    const endRow = subtask.endRow || (allData.length - 1)
    
    const subtaskData = allData.slice(startRow, endRow + 1).map((row, index) => ({
      id: `row-${startRow + index}`,
      index: startRow + index,
      data: row
    }))

    return NextResponse.json({
      data: subtaskData,
      total: subtaskData.length,
      startRow,
      endRow
    })
  } catch (error) {
    console.error("获取子任务数据失败:", error)
    return NextResponse.json(
      { message: "获取子任务数据失败，请稍后再试" },
      { status: 500 }
    )
  }
}
