import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    const { id: taskId } = await params

    // 获取标注任务及其标签文件
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        labelFile: true,
        subtasks: {
          where: {
            workerId: session.user.id, // 只检查当前用户认领的子任务
          },
          include: {
            annotations: {
              include: {
                selections: true,
              },
            },
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ message: "任务不存在" }, { status: 404 })
    }

    // 如果当前用户没有认领任何子任务
    if (task.subtasks.length === 0) {
      return NextResponse.json(
        { message: "您未认领此任务的任何子任务" },
        { status: 400 }
      )
    }

    // 解析标签文件获取维度数量
    let dimensionCount = 1 // 默认1个维度
    if (task.labelFile?.data) {
      try {
        const labelData = task.labelFile.data as any
        if (Array.isArray(labelData.dimensions)) {
          dimensionCount = labelData.dimensions.length
        } else if (labelData.categories) {
          dimensionCount = 1
        }
      } catch (e) {
        console.error("解析标签文件失败:", e)
      }
    }

    // 计算当前用户的可操作与已提交子任务数量
    const actionableCount = task.subtasks.filter(
      (s) => s.status === "CLAIMED" || s.status === "IN_PROGRESS"
    ).length
    const submittedCount = task.subtasks.filter(
      (s) => s.status === "PENDING_REVIEW" || s.status === "COMPLETED"
    ).length
    // 满足：没有可操作子任务且至少有一个已提交/已完成子任务时，才视为已提交
    const alreadySubmitted = actionableCount === 0 && submittedCount > 0

    // 检查每个子任务
    for (const subtask of task.subtasks) {
      const expectedRowCount = subtask.rowCount
      const annotatedRows = new Set<number>()

      // 统计每行的标注情况
      for (const annotation of subtask.annotations) {
        const rowIndex = annotation.rowIndex
        const selectionDimensions = new Set(
          annotation.selections.map((s) => s.dimensionName)
        )

        // 检查该行是否所有维度都有标注
        if (annotation.selections.length >= dimensionCount) {
          annotatedRows.add(rowIndex)
        }
      }

      // 检查是否所有行都已标注
      if (annotatedRows.size < expectedRowCount) {
        return NextResponse.json({
          isComplete: false,
          message: `子任务"${subtask.title}"中存在未完成的标注（已完成 ${annotatedRows.size}/${expectedRowCount} 条）`,
          subtaskTitle: subtask.title,
          completedCount: annotatedRows.size,
          totalCount: expectedRowCount,
        })
      }
    }

    // 所有子任务的所有数据都已标注完成
    return NextResponse.json({
      isComplete: true,
      alreadySubmitted,
      actionableCount,
      submittedCount,
      message: alreadySubmitted
        ? "已提交，所有当前认领的子任务均进入待审核或已完成"
        : "所有标注数据已完成，可提交审核",
    })
  } catch (error) {
    console.error("检查标注完成度失败:", error)
    return NextResponse.json(
      { message: "检查失败", error: String(error) },
      { status: 500 }
    )
  }
}
