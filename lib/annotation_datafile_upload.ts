/**
 * 从 label 文件的 schema 中提取所有一级分类名称
 * 例如：['天文地理', '历史文明', '工业技术', ...]
 */
export function extractRequirementVectorDimensions(labelData: any): string[] {
  const dimensions = Array.isArray(labelData?.dimensions) ? labelData.dimensions : []
  const firstDimension = dimensions[0]
  const schema = Array.isArray(firstDimension?.schema) ? firstDimension.schema : []
  const names = new Set<string>()

  for (const node of schema) {
    const name = typeof node?.name === 'string' ? node.name.trim() : ''
    if (name) names.add(name)
  }

  const result = Array.from(names)
  // console.log("[requirementVector] 提取到的 names:", result)
  return result
}

/**
 * 生成指定维度的 0 向量
 */
export function buildZeroRequirementVector(dimensionNames: string[] = []): Record<string, number> {
  const names = Array.isArray(dimensionNames) ? dimensionNames.filter(Boolean) : []
  return Object.fromEntries(names.map((name) => [name, 0]))
}

/**
 * 解析 CSV 文件并返回结构化数据
 */
export async function parseCSVFile(file: File, dimensionNames: string[] = []): Promise<{
  columns: string[]
  data: any[]
  rowCount: number
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const zeroVector = buildZeroRequirementVector(dimensionNames)

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const lines = content.split('\n').filter(line => line.trim())

        if (lines.length === 0) {
          reject(new Error('文件为空'))
          return
        }

        const columns = lines[0].split(',').map(col => col.trim())
        const hasRequirementVector = columns.includes('requirementVector')

        const data = lines.slice(1).map((line: string, index: number) => {
          const values = line.split(',').map(val => val.trim())
          const row: any = { _rowIndex: index + 1 }

          columns.forEach((col, colIndex) => {
            row[col] = values[colIndex] || ''
          })

          if (!hasRequirementVector) {
            row.requirementVector = zeroVector
          } else if (Object.prototype.hasOwnProperty.call(row, 'requirementVector')) {
            const vec = row.requirementVector
            row.requirementVector = typeof vec === 'string' ? JSON.parse(vec) : (vec || zeroVector)
          }

          return row
        })

        const finalColumns = hasRequirementVector ? columns : [...columns, 'requirementVector']

        resolve({
          columns: finalColumns,
          data,
          rowCount: data.length
        })

        resolve({
          columns,
          data,
          rowCount: data.length
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

import * as XLSX from 'xlsx'

/**
 * 解析 Excel 文件
 */
export async function parseExcelFile(file: File, dimensionNames: string[] = []): Promise<{
  columns: string[]
  data: any[]
  rowCount: number
}> {
  console.log("解析 Excel 文件...")

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    if (jsonData.length === 0) {
      throw new Error("Excel 文件为空")
    }
    // console.log("dimensions:", dimensionNames)
    const zeroVector = buildZeroRequirementVector(dimensionNames)
    // console.log("zeroVector:", zeroVector)
    const columns = Object.keys(jsonData[0] as any)
    const hasRequirementVector = columns.includes('requirementVector')
    const rowCount = jsonData.length

    const data = jsonData.map((row: any) => {
      const normalizedRow = { ...row }

      if (!hasRequirementVector) {
        normalizedRow.requirementVector = zeroVector
      } else if (Object.prototype.hasOwnProperty.call(normalizedRow, 'requirementVector')) {
        const vec = normalizedRow.requirementVector
        normalizedRow.requirementVector = typeof vec === 'string' ? JSON.parse(vec) : (vec || zeroVector)
      }

      return normalizedRow
    })

    const finalColumns = hasRequirementVector ? columns : [...columns, 'requirementVector']

    return {
      columns: finalColumns,
      data,
      rowCount
    }

  } catch (error) {
    throw new Error(`Excel 解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 根据文件类型选择解析器
 */
export async function parseDataFile(file: File, dimensionNames: string[] = []): Promise<{
  columns: string[]
  data: any[]
  rowCount: number
}> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'csv':
      return parseCSVFile(file, dimensionNames)
    case 'xlsx':
    case 'xls':
      return parseExcelFile(file, dimensionNames)
    default:
      throw new Error(`不支持的文件格式: ${extension}`)
  }
}

/**
 * 验证文件格式和大小
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['.csv', '.xlsx', '.xls']
  const maxSize = 10 * 1024 * 1024 // 10MB
  
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  
  if (!allowedTypes.includes(extension)) {
    return {
      valid: false,
      error: `不支持的文件格式。支持格式: ${allowedTypes.join(', ')}`
    }
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `文件大小不能超过 ${maxSize / 1024 / 1024}MB`
    }
  }
  
  return { valid: true }
}
