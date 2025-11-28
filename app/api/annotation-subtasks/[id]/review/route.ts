import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

interface ReviewSelectionDTO {
  pathIds: string[]
  pathNames?: string[]
  dimensionName?: string
}

interface ReviewItem {
  rowIndex: number
  status?: string // APPROVED | REJECTED | PENDING
  selections?: ReviewSelectionDTO[]
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
    const isPublisher = subtask.task.publisherId === session.user.id
    const isAdmin = session.user.role === "ADMIN"
    if (!isPublisher && !isAdmin) {
      return NextResponse.json({ message: "无权限进行审核" }, { status: 403 })
    }

    const body = await req.json()
    const { annotations }: { annotations: ReviewItem[] } = body
    if (!annotations || !Array.isArray(annotations)) {
      return NextResponse.json({ message: "无效的审核数据" }, { status: 400 })
    }

    // 读取现有注释以便按 rowIndex 定位
    const existing = await db.annotation.findMany({
      where: { subtaskId },
      include: { selections: true },
    })
    const byRow = new Map(existing.map((a) => [a.rowIndex, a]))

    await db.$transaction(async (tx) => {
      for (const item of annotations) {
        const target = byRow.get(item.rowIndex)
        if (!target) continue

        // 更新状态（通过/不通过）
        const nextStatus = item.status || target.status
        await tx.annotation.update({
          where: { id: target.id },
          data: { status: nextStatus },
        })

        // 更新分类：删除旧 selections，创建新 selections（若提供）
        if (Array.isArray(item.selections)) {
          await tx.annotationSelection.deleteMany({ where: { annotationId: target.id } })

          // 预处理，去重并仅保留叶子路径
          const candidates = item.selections
            .filter((s) => Array.isArray(s.pathIds) && s.pathIds.length > 0)
            .map((s) => ({
              pathIds: [...s.pathIds],
              pathNames: s.pathNames,
              dimensionName: s.dimensionName || "默认分类",
            }))

          const uniqueByKey = new Map<string, { pathIds: string[]; pathNames?: string[]; dimensionName?: string }>()
          for (const s of candidates) {
            const key = `${s.dimensionName || "默认分类"}|${s.pathIds.join('/')}`
            if (!uniqueByKey.has(key)) uniqueByKey.set(key, s)
          }
          const uniqueSelections = Array.from(uniqueByKey.values())

          const leafOnly = uniqueSelections.filter((a) => {
            return !uniqueSelections.some((b) => {
              if (a === b) return false
              if ((a.dimensionName || "默认分类") !== (b.dimensionName || "默认分类")) return false
              if (b.pathIds.length <= a.pathIds.length) return false
              for (let i = 0; i < a.pathIds.length; i++) {
                if (a.pathIds[i] !== b.pathIds[i]) return false
              }
              return true
            })
          })

          const createPayload = leafOnly.map((s, idx) => ({
            pathIds: s.pathIds as unknown as any,
            pathNames: (s.pathNames as unknown as any) ?? undefined,
            dimensionName: s.dimensionName || "默认分类",
            dimensionIndex: idx,
          }))

          if (createPayload.length) {
            await tx.annotation.update({
              where: { id: target.id },
              data: { selections: { create: createPayload } },
            })
          }
        }
      }
    })

    return NextResponse.json({ message: "审核修改已保存" })
  } catch (error) {
    console.error("保存审核数据失败:", error)
    return NextResponse.json(
      { message: "保存审核数据失败，请稍后再试" },
      { status: 500 }
    )
  }
}
