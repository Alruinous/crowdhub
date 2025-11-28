import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    if (session.user.role !== "PUBLISHER") {
      return NextResponse.json({ error: "只有发布者可以创建标注任务" }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      maxWorkers,
      categoryId,
      dataFileId,
      labelFileId,
      rowsPerTask = 20, // 默认20行
      splitMethod = "auto" // 默认自动拆分
    } = body

    // 验证必需字段
    if (!title || !dataFileId || !labelFileId) {
      return NextResponse.json(
        { error: "缺少必需字段：标题、数据文件ID、标签文件ID" },
        { status: 400 }
      )
    }

    // 验证文件是否存在
    const dataFile = await db.dataFile.findUnique({
      where: { id: dataFileId }
    })

    if (!dataFile) {
      return NextResponse.json(
        { error: "数据文件不存在" },
        { status: 400 }
      )
    }

    const labelFile = await db.labelFile.findUnique({
      where: { id: labelFileId }
    })

    if (!labelFile) {
      return NextResponse.json(
        { error: "标签文件不存在" },
        { status: 400 }
      )
    }

    // 验证文件是否已被其他任务使用
    const existingDataFileTask = await db.annotationTask.findFirst({
      where: { dataFileId }
    })

    if (existingDataFileTask) {
      return NextResponse.json(
        { error: "数据文件已被其他任务使用" },
        { status: 400 }
      )
    }

    const existingLabelFileTask = await db.annotationTask.findFirst({
      where: { labelFileId }
    })

    if (existingLabelFileTask) {
      return NextResponse.json(
        { error: "标签文件已被其他任务使用" },
        { status: 400 }
      )
    }

    // 计算任务总积分：按数据总行数（一条一分）
    const totalPoints = dataFile.rowCount || 0

    // 创建标注任务
    const annotationTask = await db.annotationTask.create({
      data: {
        title,
        description: description || null,
        points: totalPoints,
        maxWorkers: maxWorkers || 1,
        status: "OPEN",
        approved: false,
        publisherId: session.user.id,
        categoryId: categoryId || null,
        dataFileId,
        labelFileId
      },
      include: {
        dataFile: {
          select: {
            id: true,
            originalName: true,
            rowCount: true,
            columns: true
          }
        },
        labelFile: {
          select: {
            id: true,
            originalName: true,
            data: true
          }
        }
      }
    })

    // 更新 DataFile 和 LabelFile 的 annotationTask 关联
    await Promise.all([
      db.dataFile.update({
        where: { id: dataFileId },
        data: { annotationTask: { connect: { id: annotationTask.id } } }
      }),
      db.labelFile.update({
        where: { id: labelFileId },
        data: { annotationTask: { connect: { id: annotationTask.id } } }
      })
    ])

    // 根据数据文件的行数自动创建子任务
    const rowCount = dataFile.rowCount || 0
    
    // 只有当拆分方式为auto时才自动创建子任务
    if (splitMethod === "auto" && rowCount > 0) {
      const rowsPerSubtask = rowsPerTask // 使用前端传递的行数设置
      const subtaskCount = Math.ceil(rowCount / rowsPerSubtask)

      const subtasks = []
      
      for (let i = 0; i < subtaskCount; i++) {
        const startRow = i * rowsPerSubtask  // 从0开始，而不是1
        const endRow = Math.min((i + 1) * rowsPerSubtask - 1, rowCount - 1)  // 到rowCount-1
        const subtaskRowCount = endRow - startRow + 1
        
        const subtask = await db.annotationSubtask.create({
          data: {
            title: `子任务 ${i + 1}`,
            description: `处理数据行 ${startRow}-${endRow}`,
            points: subtaskRowCount, // 子任务积分=子任务行数
            status: "OPEN",
            startRow,
            endRow,
            rowCount: subtaskRowCount,
            taskId: annotationTask.id
          }
        })
        
        subtasks.push(subtask)
      }
      
      console.log(`为任务 ${annotationTask.id} 创建了 ${subtasks.length} 个子任务，每子任务 ${rowsPerSubtask} 行`)
    } else if (splitMethod === "custom") {
      // 自定义拆分模式，暂时不创建子任务，等待手动创建
      console.log(`任务 ${annotationTask.id} 使用自定义拆分模式，暂不自动创建子任务`)
    }

    return NextResponse.json({
      success: true,
      annotationTask: {
        id: annotationTask.id,
        title: annotationTask.title,
        description: annotationTask.description,
        points: annotationTask.points,
        maxWorkers: annotationTask.maxWorkers,
        status: annotationTask.status,
        dataFile: annotationTask.dataFile,
        labelFile: annotationTask.labelFile,
        createdAt: annotationTask.createdAt
      }
    })

  } catch (error) {
    console.error("创建标注任务错误:", error)
    return NextResponse.json(
      { error: "创建标注任务失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = {}
    
    if (status) {
      where.status = status
    }

    // 根据用户角色过滤任务
    if (session.user.role === "PUBLISHER") {
      where.publisherId = session.user.id
    } else if (session.user.role === "WORKER") {
      // 接单者只能看到已批准的任务
      where.approved = true
      where.status = "OPEN"
    }

    const [annotationTasks, totalCount] = await Promise.all([
      db.annotationTask.findMany({
        where,
        include: {
          dataFile: {
            select: {
              id: true,
              originalName: true,
              rowCount: true
            }
          },
          labelFile: {
            select: {
              id: true,
              originalName: true
            }
          },
          publisher: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          category: {
            select: {
              id: true,
              name: true
            }
          },
          subtasks: {
            select: {
              id: true,
              title: true,
              status: true,
              worker: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.annotationTask.count({ where })
    ])

    return NextResponse.json({
      success: true,
      annotationTasks,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error("获取标注任务列表错误:", error)
    return NextResponse.json(
      { error: "获取标注任务列表失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    )
  }
}
