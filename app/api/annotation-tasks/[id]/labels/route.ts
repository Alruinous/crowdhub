import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

interface LabelCategory {
  id: string
  type: string
  name: string
  children?: LabelCategory[]
}

interface MultiDimensionLabelData {
  dimensions: {
    name: string;  // 维度名称（工作表名称）
    categories: LabelCategory[];
  }[];
  hasLabelFile: boolean;
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

    const { id: taskId } = await params

    // 验证任务是否存在
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        labelFile: true,
      },
    })

    if (!task) {
      return NextResponse.json({ message: "标注任务不存在" }, { status: 404 })
    }

    // 从标签文件中获取分类数据
    const dimensions: MultiDimensionLabelData['dimensions'] = []
    
    if (task.labelFile && task.labelFile.data) {
      // 如果标签文件存在，使用标签文件中的数据
      try {
        const labelData = task.labelFile.data as any
        
        // 检查是否是新的多维度格式
        if (labelData.dimensions && Array.isArray(labelData.dimensions)) {
          // 多维度格式
          for (const dimension of labelData.dimensions) {
            if (dimension.schema && Array.isArray(dimension.schema)) {
              const categories = dimension.schema.map((category: any, index: number) => ({
                ...category,
                id: category.id || `${dimension.name}-category-${index + 1}`
              }))
              
              dimensions.push({
                name: dimension.name,
                categories
              })
            }
          }
        } else if (Array.isArray(labelData)) {
          // 旧的单维度格式（向后兼容）
          const categories = labelData.map((category: any, index: number) => ({
            ...category,
            id: category.id || `category-${index + 1}`
          }))
          
          dimensions.push({
            name: "默认分类",
            categories
          })
        }
      } catch (error) {
        console.error("解析标签文件数据失败:", error)
      }
    }
    
    // 如果没有标签文件或解析失败，返回空数组
    if (dimensions.length === 0) {
      return NextResponse.json({ 
        message: "此任务没有可用的标签分类数据",
        dimensions: [] 
      }, { status: 404 })
    }

    return NextResponse.json({
      dimensions,
      hasLabelFile: !!task.labelFile
    })
  } catch (error) {
    console.error("获取标签分类失败:", error)
    return NextResponse.json(
      { message: "获取标签分类失败，请稍后再试" },
      { status: 500 }
    )
  }
}
