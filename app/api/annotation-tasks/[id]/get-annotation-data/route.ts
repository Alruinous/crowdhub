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

    const { id: taskId } = await params
    const userId = session.user.id

    // 验证任务是否存在并获取接单者信息
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        workers: {
          select: { id: true }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ message: "标注任务不存在" }, { status: 404 })
    }

    // 验证用户权限：必须是该任务的接单者、发布者或管理员
    const isWorker = task.workers.some(worker => worker.id === userId)

    if (!isWorker) {
      return NextResponse.json({ message: "只有Worker有权限访问此任务的数据" }, { status: 403 })
    }

    // 获取该用户在该任务下的所有标注结果
    const [allResults, unfinishedResults] = await Promise.all([
      // 查询总数
      db.annotationResult.findMany({
        where: {
          annotatorId: userId,
          annotation: {
            taskId: taskId
          }
        }
      }),
      // 查询未完成的数据
      db.annotationResult.findMany({
        where: {
          annotatorId: userId,
          isFinished: false,
          annotation: {
            taskId: taskId
          }
        },
        include: {
          annotation: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
    ])

    const total_cnt = allResults.length
    const unfinished_cnt = unfinishedResults.length
    const data = unfinishedResults

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
