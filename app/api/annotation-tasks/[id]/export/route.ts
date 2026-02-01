import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[Export] 开始导出标注结果");
    
    const session = await getServerSession(authOptions);
    console.log("[Export] 会话检查:", session ? "已登录" : "未登录");
    
    if (!session) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    const taskId = (await params).id;
    console.log("[Export] 任务ID:", taskId);

    // 获取标注任务信息（包含数据文件、标签文件和所有标注数据）
    console.log("[Export] 开始查询任务信息...");
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        publisher: {
          select: { id: true, name: true },
        },
        dataFile: true,
        labelFile: {
          select: {
            id: true,
            dimensionNames: true, // 维度名称数组
          },
        },
        annotations: {
          include: {
            results: {
              where: {
                isFinished: true, // 只导出已完成的标注结果（含标注 round=0 与复审 round=1）
              },
              include: {
                annotator: {
                  select: { id: true, name: true },
                },
                selections: {
                  orderBy: { dimensionIndex: 'asc' }, // 按维度索引排序
                },
              },
            },
          },
          orderBy: { rowIndex: 'asc' }, // 按行索引排序
        },
      },
    });

    if (!task) {
      console.log("[Export] 错误: 任务不存在");
      return NextResponse.json({ error: "标注任务不存在" }, { status: 404 });
    }

    console.log("[Export] 任务查询成功, 任务标题:", task.title);
    console.log("[Export] 任务包含的annotations数量:", task.annotations?.length || 0);

    // 检查用户是否是任务发布者或管理员
    if (task.publisherId !== session.user.id && session.user.role !== "ADMIN") {
      console.log("[Export] 错误: 无权访问此任务");
      return NextResponse.json({ error: "无权访问此任务" }, { status: 403 });
    }

    // 获取数据文件内容
    if (!task.dataFile) {
      console.log("[Export] 错误: 数据文件不存在");
      return NextResponse.json({ error: "数据文件不存在" }, { status: 400 });
    }

    console.log("[Export] 数据文件存在, 开始解析...");

    // 解析数据文件内容
    let dataRows: any[] = [];
    try {
      const dataContent = task.dataFile.data;
      
      if (Array.isArray(dataContent)) {
        dataRows = dataContent;
      } else if (typeof dataContent === 'string') {
        dataRows = JSON.parse(dataContent);
      } else if (dataContent === null || dataContent === undefined) {
        dataRows = [];
      } else {
        dataRows = [dataContent];
      }
      
      console.log("解析后的数据行数:", dataRows.length);
    } catch (error) {
      console.error("解析数据文件失败:", error);
      return NextResponse.json({ error: "数据文件格式错误" }, { status: 400 });
    }

    // 获取维度名称数组（从 labelFile 中获取）
    console.log("[Export] 开始获取维度名称...");
    const dimensionNames: string[] = [];
    if (task.labelFile?.dimensionNames) {
      console.log("[Export] labelFile.dimensionNames存在:", task.labelFile.dimensionNames);
      const names = task.labelFile.dimensionNames;
      if (Array.isArray(names)) {
        // 类型转换：JsonValue -> string[]
        dimensionNames.push(...names.filter((n): n is string => typeof n === 'string'));
        console.log("[Export] 从labelFile获取到维度名称:", dimensionNames);
      } else {
        console.log("[Export] labelFile.dimensionNames不是数组类型");
      }
    } else {
      console.log("[Export] labelFile或dimensionNames不存在");
    }

    // 如果 labelFile 中没有维度名称，尝试从标注结果中推断（兼容旧数据）
    if (dimensionNames.length === 0) {
      console.log("[Export] 从标注结果中推断维度名称...");
      const dimensionIndexSet = new Set<number>();
      task.annotations.forEach(annotation => {
        annotation.results.forEach(result => {
          result.selections.forEach(selection => {
            dimensionIndexSet.add(selection.dimensionIndex);
          });
        });
      });
      
      console.log("[Export] 检测到的维度索引:", Array.from(dimensionIndexSet).sort((a, b) => a - b));
      
      // 按索引排序，生成默认维度名称
      const sortedIndices = Array.from(dimensionIndexSet).sort((a, b) => a - b);
      sortedIndices.forEach(index => {
        dimensionNames.push(`维度${index + 1}`);
      });
      console.log("[Export] 推断出的维度名称:", dimensionNames);
    }

    console.log("[Export] 最终维度名称:", dimensionNames);

    // 创建维度索引到名称的映射
    const dimensionIndexToName = new Map<number, string>();
    dimensionNames.forEach((name, index) => {
      dimensionIndexToName.set(index, name);
    });

    // 按数据行索引分组标注结果和 annotation 信息
    console.log("[Export] 开始分组标注结果...");
    const annotationsByRowIndex: Record<number, {
      needToReview: boolean;
      results: Array<{
        annotationId: string;
        annotatorName: string;
        isCorrect: boolean | null;
        selections: Array<{
          dimensionIndex: number;
          pathNames: string[] | null;
        }>;
      }>;
    }> = {};

    let totalResults = 0;
    task.annotations.forEach((annotation, annIdx) => {
      const rowIndex = annotation.rowIndex;
      
      if (!annotationsByRowIndex[rowIndex]) {
        annotationsByRowIndex[rowIndex] = {
          needToReview: annotation.needToReview,
          results: [],
        };
      }

      console.log(`[Export] 处理annotation[${annIdx}], rowIndex: ${rowIndex}, results数量: ${annotation.results.length}`);
      
      annotation.results.forEach((result, resIdx) => {
        totalResults++;
        console.log(`[Export]   处理result[${resIdx}], 标注者: ${result.annotator.name}, selections数量: ${result.selections.length}`);
        
        annotationsByRowIndex[rowIndex].results.push({
          annotationId: annotation.id,
          annotatorName: result.annotator.name || "未知",
          isCorrect: result.isCorrect,
          selections: result.selections.map(sel => {
            // 类型转换：JsonArray -> string[]
            let pathNames: string[] | null = null;
            if (sel.pathNames && Array.isArray(sel.pathNames)) {
              pathNames = sel.pathNames.filter((p): p is string => typeof p === 'string');
            }
            return {
              dimensionIndex: sel.dimensionIndex,
              pathNames,
            };
          }),
        });
      });
    });

    console.log("[Export] 分组完成, 总结果数:", totalResults);
    console.log("[Export] 按行索引分组的标注结果数量:", Object.keys(annotationsByRowIndex).length);

    // 构建Excel数据
    console.log("[Export] 开始构建Excel数据, 数据行数:", dataRows.length);
    const excelData = dataRows.map((row, index) => {
      // 排除 requirementVector 字段
      const { requirementVector, ...rowWithoutRequirementVector } = row as any;
      const rowData: any = {
        ...rowWithoutRequirementVector,
      };

      // 处理该行的所有标注结果
      const rowAnnotation = annotationsByRowIndex[index];
      const rowResults = rowAnnotation?.results || [];
      
      // 为每个标注者创建单独的列（每个维度的分类单独一列，完成者单独一列）
      rowResults.forEach((result: {
        annotationId: string;
        annotatorName: string;
        isCorrect: boolean | null;
        selections: Array<{
          dimensionIndex: number;
          pathNames: string[] | null;
        }>;
      }, resultIndex: number) => {
        const resultPrefix = `标注结果${resultIndex + 1}`;
        
        // 为每个维度创建单独的列
        dimensionNames.forEach((dimensionName: string, dimIndex: number) => {
          const dimensionIndex = dimIndex;
          
          // 找到该标注者在该维度的选择
          const selection = result.selections.find(
            (sel: { dimensionIndex: number; pathNames: string[] | null }) => sel.dimensionIndex === dimensionIndex
          );
          
          const columnName = `${resultPrefix}_${dimensionName}`;
          
          if (selection?.pathNames && selection.pathNames.length > 0) {
            // 将多级分类路径用"_"连接
            rowData[columnName] = selection.pathNames.join("_");
          } else {
            rowData[columnName] = "未标注";
          }
        });
        
        // 完成者单独一列
        const annotatorColumnName = `${resultPrefix}_完成者`;
        rowData[annotatorColumnName] = result.annotatorName;
      });

      // 添加 needToReview 字段
      if (rowAnnotation) {
        rowData["需要复审"] = rowAnnotation.needToReview ? "是" : "否";
      } else {
        rowData["需要复审"] = "否";
      }

      return rowData;
    });

    console.log("[Export] Excel数据构建完成, 行数:", excelData.length);
    if (excelData.length > 0) {
      console.log("[Export] 第一行数据的列数:", Object.keys(excelData[0]).length);
      console.log("[Export] 第一行数据的列名示例:", Object.keys(excelData[0]).slice(0, 10));
    }

    // 创建Excel工作簿
    console.log("[Export] 开始创建Excel工作簿...");
    const workbook = XLSX.utils.book_new();
    
    // 创建工作表
    console.log("[Export] 创建工作表...");
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // 将工作表添加到工作簿
    console.log("[Export] 添加工作表到工作簿...");
    XLSX.utils.book_append_sheet(workbook, worksheet, "标注结果");

    // 生成Excel文件
    console.log("[Export] 生成Excel文件buffer...");
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    console.log("[Export] Excel文件buffer生成完成, 大小:", excelBuffer.length, "bytes");

    // 设置响应头
    const filename = `${task.title}_标注结果_${new Date().toISOString().split('T')[0]}.xlsx`;
    console.log("[Export] 准备返回文件, 文件名:", filename);
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });

  } catch (error) {
    console.error("[Export] 导出Excel失败 - 错误详情:", error);
    console.error("[Export] 错误堆栈:", error instanceof Error ? error.stack : "无堆栈信息");
    return NextResponse.json(
      { error: "导出失败，请稍后重试" },
      { status: 500 }
    );
  }
}
