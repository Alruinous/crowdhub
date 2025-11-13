import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseDataFile, validateFile } from "@/lib/annotation_datafile_upload"
import { parseLabelFile, validateLabelFile } from "@/lib/annotation_labelfile_upload"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    if (session.user.role !== "PUBLISHER") {
      return NextResponse.json({ error: "只有发布者可以上传文件" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const fileType = formData.get("fileType") as string

    if (!file) {
      return NextResponse.json({ error: "未选择文件" }, { status: 400 })
    }

    // 根据文件类型验证文件
    let validation
    if (fileType === "dataFile") {
      validation = validateFile(file)
    } else if (fileType === "labelFile") {
      validation = validateLabelFile(file)
    } else {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 })
    }
    
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    if (fileType === "dataFile") {
      try {
        // 解析文件内容
        const parsedData = await parseDataFile(file)
        
        // 创建 DataFile 记录
        const dataFile = await db.dataFile.create({
          data: {
            filename: `data-${Date.now()}.${file.name.split('.').pop()}`,
            originalName: file.name,
            path: `/uploads/data-${Date.now()}.${file.name.split('.').pop()}`,
            size: file.size,
            mimeType: file.type,
            rowCount: parsedData.rowCount,
            columns: parsedData.columns,
            data: parsedData.data
          }
        })

        return NextResponse.json({
          success: true,
          dataFile: {
            id: dataFile.id,
            // originalName: dataFile.originalName,
            // rowCount: dataFile.rowCount,
            // columns: dataFile.columns
          }
        })
      } catch (error) {
        return NextResponse.json(
          { error: `数据文件解析失败: ${error instanceof Error ? error.message : "未知错误"}` },
          { status: 400 }
        )
      }
    } else if (fileType === "labelFile") {
      try {
        // 解析标签文件内容
        const parsedData = await parseLabelFile(file)

        if (!parsedData.dimensions?.length) {
          return NextResponse.json(
            { error: "标签文件内容为空或未解析出任何层级" },
            { status: 400 }
          )
        }
        
        // 创建 LabelFile 记录
        const labelFile = await db.labelFile.create({
          data: {
            filename: `label-${Date.now()}.${file.name.split('.').pop()}`,
            originalName: file.name,
            path: `/uploads/label-${Date.now()}.${file.name.split('.').pop()}`,
            size: file.size,
            data: parsedData as any // 使用类型断言处理 JSON 类型
          }
        })

        return NextResponse.json({
          success: true,
          labelFile: {
            id: labelFile.id,
            // originalName: labelFile.originalName,
            // rowCount: parsedData.rowCount,
            // data: parsedData.labelSchema
          }
        })
      } catch (error) {
        return NextResponse.json(
          { error: `标签文件解析失败: ${error instanceof Error ? error.message : "未知错误"}` },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 })
    }
    

  } catch (error) {
    console.error("文件上传错误:", error)
    return NextResponse.json(
      { error: "文件上传失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    )
  }
}
