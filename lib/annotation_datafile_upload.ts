/**
 * 解析 CSV 文件并返回结构化数据
 */
export async function parseCSVFile(file: File): Promise<{
  columns: string[]
  data: any[]
  rowCount: number
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const lines = content.split('\n').filter(line => line.trim())
        
        if (lines.length === 0) {
          reject(new Error('文件为空'))
          return
        }
        
        // 第一行是列名
        const columns = lines[0].split(',').map(col => col.trim())
        
        // 解析数据行
        const data = lines.slice(1).map((line: string, index: number) => {
          const values = line.split(',').map(val => val.trim())
          const row: any = { _rowIndex: index + 1 }
          
          columns.forEach((col, colIndex) => {
            row[col] = values[colIndex] || ''
          })
          
          return row
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
export async function parseExcelFile(file: File): Promise<{
  columns: string[]
  data: any[]
  rowCount: number
}> {
  console.log("解析 Excel 文件...")
  
  try {
    // 将 File 对象转换为 Buffer（Node.js 兼容方式）
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // 使用 buffer 读取 Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    
    if (jsonData.length === 0) {
      throw new Error("Excel 文件为空")
    }
    
    const columns = Object.keys(jsonData[0] as any)
    const rowCount = jsonData.length
    
    return {
      columns,
      data: jsonData,
      rowCount
    }
    
  } catch (error) {
    throw new Error(`Excel 解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 根据文件类型选择解析器
 */
export async function parseDataFile(file: File): Promise<{
  columns: string[]
  data: any[]
  rowCount: number
}> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'csv':
      return parseCSVFile(file)
    case 'xlsx':
    case 'xls':
      return parseExcelFile(file)
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
