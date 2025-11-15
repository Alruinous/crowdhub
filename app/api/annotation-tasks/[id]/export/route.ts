import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    const taskId = (await params).id;

    // 获取标注任务信息
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        publisher: {
          select: { id: true, name: true },
        },
        dataFile: true,
        labelFile: true,
        subtasks: {
          include: {
            worker: {
              select: { id: true, name: true },
            },
            annotations: {
              include: {
                selections: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "标注任务不存在" }, { status: 404 });
    }

    // 检查用户是否是任务发布者或管理员
    if (task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权访问此任务" }, { status: 403 });
    }

    // 获取数据文件内容
    if (!task.dataFile) {
      return NextResponse.json({ error: "数据文件不存在" }, { status: 400 });
    }

    // 解析数据文件内容
    let dataRows: any[] = [];
    try {
      // 数据文件内容可能是直接数组，也可能是JSON字符串
      const dataContent = task.dataFile.data;
      
      if (Array.isArray(dataContent)) {
        dataRows = dataContent;
      } else if (typeof dataContent === 'string') {
        dataRows = JSON.parse(dataContent);
      } else if (dataContent === null || dataContent === undefined) {
        dataRows = [];
      } else {
        // 尝试将其他类型转换为数组
        dataRows = [dataContent];
      }
      
      console.log("解析后的数据行数:", dataRows.length);
    } catch (error) {
      console.error("解析数据文件失败:", error);
      return NextResponse.json({ error: "数据文件格式错误" }, { status: 400 });
    }

    // 收集所有标注数据
    const allAnnotations = task.subtasks.flatMap(subtask => 
      subtask.annotations.map(annotation => ({
        ...annotation,
        subtaskTitle: subtask.title,
        workerName: subtask.worker?.name || "未知",
        subtaskStatus: subtask.status,
      }))
    );

    console.log("总标注数量:", allAnnotations.length);
    // console.log("标注数据结构:", JSON.stringify(allAnnotations.slice(0, 2), null, 2));

    // 按数据行索引分组标注
    const annotationsByRowIndex: Record<number, any[]> = {};
    allAnnotations.forEach(annotation => {
      const rowIndex = annotation.rowIndex;
      if (!annotationsByRowIndex[rowIndex]) {
        annotationsByRowIndex[rowIndex] = [];
      }
      annotationsByRowIndex[rowIndex].push(annotation);
    });

    console.log("按行索引分组的标注:", Object.keys(annotationsByRowIndex).length);

    // 获取所有维度名称（用于动态生成列）
    const allDimensionNames = new Set<string>();
    allAnnotations.forEach(annotation => {
      if (annotation.selections && Array.isArray(annotation.selections)) {
        annotation.selections.forEach((selection: any) => {
          if (selection.dimensionName) {
            allDimensionNames.add(selection.dimensionName);
          }
        });
      }
    });
    const dimensionNames = Array.from(allDimensionNames);

    console.log("检测到的维度:", dimensionNames);
    

    // 构建Excel数据
    const excelData = dataRows.map((row, index) => {
      const rowData: any = {
        ...row,
      };

      // 处理该行的所有标注
      const rowAnnotations = annotationsByRowIndex[index] || [];
      // console.log("###",rowAnnotations)
      
      // 为每个维度收集分类路径
      const dimensionCategoryPaths: Record<string, string[]> = {};
      
      // 初始化所有维度的空数组
      dimensionNames.forEach(dimensionName => {
        dimensionCategoryPaths[dimensionName] = [];
      });

      rowAnnotations.forEach((annotation: any) => {
        if (annotation.selections && Array.isArray(annotation.selections)) {
          annotation.selections.forEach((selection: any) => {
            console.log("###selection",selection)
            const dimensionName = selection.dimensionName || "默认分类";
            if (selection.pathNames) {
              try {
                const pathNames = selection.pathNames;
                console.log("解析的pathNames:", pathNames);
                if (Array.isArray(pathNames) && pathNames.length > 0) {
                  // 将多级分类路径用"_"连接，不要空格
                  const categoryPath = pathNames.join("_");
                  console.log("解析的categoryPath:", categoryPath);
                  dimensionCategoryPaths[dimensionName].push(categoryPath);
                }
              } catch (error) {
                // 如果解析失败，尝试直接使用pathNames
                if (Array.isArray(selection.pathNames) && selection.pathNames.length > 0) {
                  const categoryPath = selection.pathNames.join("_");
                  dimensionCategoryPaths[dimensionName].push(categoryPath);
                }
              }
            }
          });
        }
      });
      console.log("维度分类路径:", dimensionCategoryPaths);

      // 为每个维度创建单独的单元格（列名后缀“(分类)”避免与原数据字段重名）
      dimensionNames.forEach(dimensionName => {
        const categoryPaths = dimensionCategoryPaths[dimensionName];
        const columnName = `${dimensionName}(分类)`;
        if (categoryPaths.length > 0) {
          // 将同一维度下的多个分类路径用";"分隔
          rowData[columnName] = categoryPaths.join(";");
        } else {
          rowData[columnName] = "未标注";
        }
      });

      // 保留标注者信息
      const uniqueWorkers = [...new Set(rowAnnotations.map((a: any) => a.workerName))];
      if (uniqueWorkers.length > 0) {
        rowData["标注者"] = uniqueWorkers.join(";");
      }

      return rowData;
    });

    // 创建Excel工作簿
    const workbook = XLSX.utils.book_new();
    
    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, "标注结果");

    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // 设置响应头
    const filename = `${task.title}_标注结果_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });

  } catch (error) {
    console.error("导出Excel失败:", error);
    return NextResponse.json(
      { error: "导出失败，请稍后重试" },
      { status: 500 }
    );
  }
}
