import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { id: taskId } = await params

    // 获取任务信息
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      select: {
        publisherId: true,
        dataFileId: true,
        labelFileId: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 })
    }

    // 检查权限：只有发布者或管理员可以删除
    if (task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限删除该任务" }, { status: 403 })
    }

    // 开始级联删除
    // Prisma schema 中的 onDelete: Cascade 会自动处理以下级联删除：
    // - AnnotationSubtask (子任务)
    // - Annotation (标注结果，通过子任务)
    // - AnnotationSelection (标注选择，通过标注结果)
    // - AnnotationMessage (消息)
    
    const dataFileId = task.dataFileId
    const labelFileId = task.labelFileId

    // 删除任务（会自动级联删除相关记录）
    await db.annotationTask.delete({
      where: { id: taskId },
    })

    // 删除关联的数据文件
    if (dataFileId) {
      await db.dataFile.delete({
        where: { id: dataFileId },
      }).catch(() => {
        // 忽略文件可能已被删除的错误
      })
    }

    // 删除关联的标签文件
    if (labelFileId) {
      await db.labelFile.delete({
        where: { id: labelFileId },
      }).catch(() => {
        // 忽略文件可能已被删除的错误
      })
    }

    return NextResponse.json({ message: "任务删除成功" }, { status: 200 })
  } catch (error) {
    console.error("删除任务失败:", error)
    return NextResponse.json(
      { error: "删除任务失败，请稍后重试" },
      { status: 500 }
    )
  }
}
