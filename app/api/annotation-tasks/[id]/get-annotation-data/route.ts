import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

const ROUND_ANNOTATE = 0
const ROUND_REVIEW = 1

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ message: "未授权" }, { status: 401 })
    }

    const { id: taskId } = await params
    const userId = session.user.id

    // round=0 标注，round=1 复审；默认 0
    const url = new URL(req.url)
    const roundParam = url.searchParams.get("round")
    const round = roundParam === "1" ? ROUND_REVIEW : ROUND_ANNOTATE

    // 验证任务是否存在并获取接单者、复审员信息
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        workers: { select: { id: true } },
        annotationTaskReviewers: {
          where: { level: 1 },
          select: { userId: true },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ message: "标注任务不存在" }, { status: 404 })
    }

    const isWorker = Array.isArray(task.workers) && task.workers.some((w) => w.id === userId)
    const isReviewer =
      Array.isArray(task.annotationTaskReviewers) &&
      task.annotationTaskReviewers.some((r) => r.userId === userId)

    // 标注：必须是接单者；复审：必须是一级复审员
    if (round === ROUND_ANNOTATE && !isWorker) {
      return NextResponse.json({ message: "只有接单者有权限访问标注数据" }, { status: 403 })
    }
    if (round === ROUND_REVIEW && !isReviewer) {
      return NextResponse.json({ message: "只有复审员有权限访问复审数据" }, { status: 403 })
    }

    // 获取该用户在该任务下、该 round 的未完成结果（含 selections 供标注页使用）
    const [allResults, unfinishedResults] = await Promise.all([
      db.annotationResult.findMany({
        where: {
          annotatorId: userId,
          round,
          annotation: { taskId },
        },
      }),
      db.annotationResult.findMany({
        where: {
          annotatorId: userId,
          round,
          isFinished: false,
          annotation: { taskId },
        },
        include: {
          annotation: true,
          selections: { orderBy: { dimensionIndex: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ])

    const total_cnt = allResults.length
    const unfinished_cnt = unfinishedResults.length
    let data = unfinishedResults

    // 复审模式：为每条结果附带该条目上其他标注员（round=0）的标注结果
    if (round === ROUND_REVIEW && unfinishedResults.length > 0) {
      const annotationIds = unfinishedResults.map((r) => r.annotationId)
      const otherResults = await db.annotationResult.findMany({
        where: {
          annotationId: { in: annotationIds },
          round: 0,
        },
        include: {
          selections: { orderBy: { dimensionIndex: "asc" } },
          annotator: { select: { id: true, name: true } },
        },
      })
      const byAnnotationId = new Map<string, typeof otherResults>()
      for (const r of otherResults) {
        if (!byAnnotationId.has(r.annotationId)) byAnnotationId.set(r.annotationId, [])
        byAnnotationId.get(r.annotationId)!.push(r)
      }
      data = unfinishedResults.map((r) => {
        const others = byAnnotationId.get(r.annotationId) ?? []
        const otherAnnotatorResults = others.map((o) => ({
          userId: o.annotatorId,
          userName: o.annotator.name,
          selections: o.selections.map((s) => ({
            dimensionIndex: s.dimensionIndex,
            pathIds: (s.pathIds as string[]) ?? [],
            pathNames: (s.pathNames as string[] | null) ?? undefined,
          })),
        }))
        return { ...r, otherAnnotatorResults }
      })
    }

//返回值示例：
// {
//   "data": [
//     {
//       "id": "clx1a2b3c4d5e6f7g8h9i0j1",
//       "annotationId": "clx9z8y7x6w5v4u3t2s1r0q9",
//       "annotatorId": "user123456",
//       "isCorrect": null,
//       ...
//     },
//   ...
//   ],
//   "total_cnt": 50,
//   "unfinished_cnt": 2
// }

    return NextResponse.json({
      data,
      total_cnt,
      unfinished_cnt
    })
  } catch (error) {
    console.error("获取标注数据失败:", error)
    return NextResponse.json(
      { message: "获取标注数据失败，请稍后再试" },
      { status: 500 }
    )
  }
}
