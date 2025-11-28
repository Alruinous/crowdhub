import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

interface AnnotationSelectionDTO {
  pathIds: string[]
  pathNames?: string[]
  dimensionName?: string
}

interface AnnotationRequest {
  rowIndex: number
  rowData: Record<string, any>
  // 标注选择数据
  selections?: AnnotationSelectionDTO[]
  status?: string
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    const { id: subtaskId } = await params

    const subtask = await db.annotationSubtask.findUnique({
      where: { id: subtaskId },
      include: { task: true },
    })
    if (!subtask) {
      return NextResponse.json({ message: "标注子任务不存在" }, { status: 404 })
    }
    if (subtask.workerId !== session.user.id) {
      return NextResponse.json({ message: "您没有权限标注此子任务" }, { status: 403 })
    }
    if (subtask.status !== "IN_PROGRESS") {
      return NextResponse.json({ message: "此子任务不在标注状态" }, { status: 400 })
    }

    const body = await req.json()
    const { annotations }: { annotations: AnnotationRequest[] } = body

    if (!annotations || !Array.isArray(annotations)) {
      return NextResponse.json({ message: "无效的标注数据" }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      // 清空旧数据（会级联删除 selections）
      await tx.annotation.deleteMany({ where: { subtaskId } })

      const created = await Promise.all(
        annotations.map(async (ann) => {
          // 处理标注选择数据（仅保留叶子节点，去重并移除前缀路径）
          const normalizedSelections: AnnotationSelectionDTO[] = []

          if (Array.isArray(ann.selections)) {
            for (const s of ann.selections) {
              if (s && Array.isArray(s.pathIds) && s.pathIds.length > 0) {
                normalizedSelections.push({
                  pathIds: [...s.pathIds],
                  pathNames: s.pathNames,
                  dimensionName: s.dimensionName || "默认分类",
                })
              }
            }
          }

          // 去重（按 维度名 + 路径）
          const uniqueByKey = new Map<string, AnnotationSelectionDTO>()
          for (const s of normalizedSelections) {
            const key = `${s.dimensionName || "默认分类"}|${s.pathIds.join('/')}`
            if (!uniqueByKey.has(key)) uniqueByKey.set(key, s)
          }
          const uniqueSelections = Array.from(uniqueByKey.values())

          // 仅保留叶子（移除被其他选择当作前缀的路径）
          const leafOnly = uniqueSelections.filter((a) => {
            return !uniqueSelections.some((b) => {
              if (a === b) return false
              if ((a.dimensionName || "默认分类") !== (b.dimensionName || "默认分类")) return false
              if (b.pathIds.length <= a.pathIds.length) return false
              // b 以 a 为前缀
              for (let i = 0; i < a.pathIds.length; i++) {
                if (a.pathIds[i] !== b.pathIds[i]) return false
              }
              return true
            })
          })

          const allSelections = leafOnly.map((selection) => ({
            ...selection,
            dimensionName: selection.dimensionName || "默认分类",
          }))

          const createdAnn = await tx.annotation.create({
            data: {
              rowIndex: ann.rowIndex,
              rowData: ann.rowData,
              status: ann.status || "PENDING",
              subtaskId,
              annotatorId: session.user.id,
              selections: {
                create: allSelections.map((s, index) => ({
                  pathIds: s.pathIds as unknown as any,
                  pathNames: (s.pathNames as unknown as any) ?? undefined,
                  dimensionName: s.dimensionName || "默认分类",
                  dimensionIndex: index,
                })),
              },
            },
            include: { selections: true },
          })

          return createdAnn
        })
      )

      // await tx.annotationSubtask.update({
      //   where: { id: subtaskId },
      //   data: { status: "PENDING_REVIEW" },
      // })

      return created
    })

    return NextResponse.json({
      message: "标注数据保存成功",
      annotations: result,
    })
  } catch (error) {
    console.error("保存标注数据失败:", error)
    return NextResponse.json(
      { message: "保存标注数据失败，请稍后再试" },
      { status: 500 }
    )
  }
}

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

    const subtask = await db.annotationSubtask.findUnique({
      where: { id: subtaskId },
      include: { task: true },
    })
    if (!subtask) {
      return NextResponse.json({ message: "标注子任务不存在" }, { status: 404 })
    }

    const canView =
      subtask.workerId === session.user.id ||
      subtask.task.publisherId === session.user.id ||
      session.user.role === "ADMIN"

    if (!canView) {
      return NextResponse.json({ message: "您没有权限查看此标注数据" }, { status: 403 })
    }

    const annotations = await db.annotation.findMany({
      where: { subtaskId },
      orderBy: { rowIndex: "asc" },
      include: { selections: true },
    })
    

    // 以便前端直接回显
    const shaped = annotations.map((a) => ({
      id: a.id,
      rowIndex: a.rowIndex,
      rowData: a.rowData,
      status: a.status,
      selections: a.selections.map((s) => ({
        pathIds: s.pathIds as unknown as string[],
        pathNames: (s.pathNames as unknown as string[] | undefined) || undefined,
        dimensionName: s.dimensionName || "默认分类",
      })),
    }))
    // console.log("获取到的标注数据####:", shaped)

    return NextResponse.json({ annotations: shaped })
  } catch (error) {
    console.error("获取标注数据失败:", error)
    return NextResponse.json(
      { message: "获取标注数据失败，请稍后再试" },
      { status: 500 }
    )
  }
}
