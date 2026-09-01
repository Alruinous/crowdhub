import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildZeroRequirementVector, extractRequirementVectorDimensions } from "@/lib/annotation_datafile_upload"

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
      points,
      dataFileId,
      labelFileId,
      publishCycle = 1,    // 数据发布周期（天），默认1天
      publishLimit = 100   // 每人每次数据接受上限（条），默认100条
    } = body

    // 验证必需字段
    if (!title || !dataFileId || !labelFileId) {
      return NextResponse.json(
        { error: "缺少必需字段：标题、数据文件ID、标签文件ID" },
        { status: 400 }
      )
    }

    // 验证任务总积分：必须由发布者主动赋值，且为正整数
    if (typeof points !== "number" || !Number.isInteger(points) || points < 1) {
      return NextResponse.json(
        { error: "总积分必须是不小于1的整数" },
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

    // 创建标注任务（总积分由发布者主动赋值）
    const annotationTask = await db.annotationTask.create({
      data: {
        title,
        description: description || null,
        points,
        maxWorkers: maxWorkers || 1,
        status: "OPEN",
        approved: false,
        publishCycle: publishCycle || 1,
        publishLimit: publishLimit || 100,
        publisherId: session.user.id,
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

    // 将 dataFile 中的每条数据作为独立的 Annotation 记录存入数据库
    const dataRows = (dataFile.data as any[]) || []
    const labelData = (labelFile.data as any) || {}
    const labelRequirementDimensions = extractRequirementVectorDimensions(labelData)
    const zeroRequirementVector = buildZeroRequirementVector(labelRequirementDimensions)

    if (dataRows.length > 0) {
      console.log(`开始为任务 ${annotationTask.id} 创建 ${dataRows.length} 条数据条目...`)

      const columns = Array.isArray(dataFile.columns) ? dataFile.columns.map((col: any) => String(col).trim()) : []
      const hasRequirementVector = columns.includes('requirementVector')

      const normalizedRows = dataRows.map((row: any, index) => {
        let rowData = row
        let requirementVector: Record<string, number> | null = null

        if (hasRequirementVector) {
          const { requirementVector: vecData, ...restData } = row
          rowData = restData

          try {
            requirementVector = typeof vecData === 'string' ? JSON.parse(vecData) : vecData
          } catch (e) {
            console.warn(`解析 requirementVector 失败 (行 ${index}):`, e)
          }
        }

        if (!requirementVector || typeof requirementVector !== 'object' || Array.isArray(requirementVector)) {
          requirementVector = { ...zeroRequirementVector }
        }

        return {
          ...rowData,
          requirementVector,
        }
      })

      const finalColumns = hasRequirementVector
        ? columns
        : [...columns, 'requirementVector']

      await db.dataFile.update({
        where: { id: dataFileId },
        data: {
          columns: finalColumns,
          data: normalizedRows,
        }
      })

      await db.annotation.createMany({
        data: normalizedRows.map((row: any, index) => {
          const { requirementVector, ...restData } = row
          return {
            taskId: annotationTask.id,
            rowIndex: index,
            rowData: restData,
            requirementVector: requirementVector || { ...zeroRequirementVector },
          }
        })
      })

      console.log(`任务 ${annotationTask.id} 的 ${dataRows.length} 条数据条目已创建`)
    }

    // 注意：数据条目已创建，但处于 PENDING 状态
    console.log(`任务 ${annotationTask.id} 已创建，发布周期: ${publishCycle}天，每次上限: ${publishLimit}条`)

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
