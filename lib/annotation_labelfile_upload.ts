import * as XLSX from 'xlsx'

export interface LabelCategoryNode {
  id?: number
  type: string
  name: string
  children?: LabelCategoryNode[]
  childrenCnt?: number
}

// 最少需要的层级列数量（可按需改成 1、2、3）
const MIN_LEVELS = 1

export interface MultiDimensionLabelSchema {
  dimensions: {
    name: string;  // 维度名称（工作表名称）
    schema: LabelCategoryNode[];
    rowCount: number;
  }[];
  totalRowCount: number;
}

export async function parseLabelFile(file: File): Promise<MultiDimensionLabelSchema> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  
  const dimensions: {
    name: string;
    schema: LabelCategoryNode[];
    rowCount: number;
  }[] = []

  let totalRowCount = 0

  // 处理每个工作表作为一个分类维度
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet || !sheet['!ref']) continue

    // 转网格并填充合并单元格
    const { grid, range } = sheetToFilledGrid(sheet)

    // 使用第一行作为表头
    const headerRow = 0
    const headersRaw = grid[headerRow] || []
    if (headersRaw.every(h => !String(h).trim())) {
      console.warn(`工作表 "${sheetName}" 首行表头为空，跳过`)
      continue
    }

    // 收集连续非空列作为层级（遇到第一个空列后停止，避免后面散列）
    const headers: { col: number; header: string }[] = []
    for (let idx = 0; idx < headersRaw.length; idx++) {
      const text = (headersRaw[idx] ?? '').toString().trim()
      if (!text) {
        // 若已经开始收集且遇到空则停止
        if (headers.length > 0) break
        else continue
      }
      headers.push({ col: idx, header: text })
    }

    if (headers.length < MIN_LEVELS) {
      console.warn(`工作表 "${sheetName}" 表头层级列不足，至少需要 ${MIN_LEVELS} 列，当前仅 ${headers.length} 列，跳过`)
      continue
    }

    const categoryCols = headers
    const startRow = headerRow + 1
    const labelSchema: LabelCategoryNode[] = []
    const levelMaps: Map<string, LabelCategoryNode>[] = categoryCols.map(() => new Map())
    let nextTopId = 1

    for (let r = startRow; r <= range.e.r; r++) {
      const row = grid[r]
      if (!row) continue
      const levels = categoryCols.map(({ col }) => (row[col] ?? '').toString().trim())
      if (levels.every(v => !v)) continue

      // 结构校验：下层不可有值而上层为空
      for (let i = 0; i < levels.length; i++) {
        if (!levels[i]) {
          if (levels.slice(i + 1).some(v => !!v)) {
            throw new Error(`工作表 "${sheetName}" 第 ${r + 1} 行结构错误：层级"${categoryCols[i].header}"为空但更低层有值`)
          }
          break
        }
      }

      let parent: LabelCategoryNode | undefined
      let parentKey = ''
      for (let i = 0; i < levels.length; i++) {
        const name = levels[i]
        if (!name) break
        const type = categoryCols[i].header
        const key = (parentKey ? parentKey + '>' : '') + `${type}:${name}`

        if (!levelMaps[i].has(key)) {
          const node: LabelCategoryNode = { type, name, childrenCnt: 0 }
          if (i < levels.length - 1) node.children = []
          if (i === 0) {
            node.id = nextTopId++
            labelSchema.push(node)
          } else if (parent) {
            parent.children = parent.children ?? []
            parent.children.push(node)
            parent.childrenCnt = parent.children.length
          }
          levelMaps[i].set(key, node)
        }
        parent = levelMaps[i].get(key)!
        parentKey = key
      }
    }

    // 递归补齐 childrenCnt
    const fillCnt = (nodes?: LabelCategoryNode[]) => {
      if (!nodes) return
      for (const n of nodes) {
        n.childrenCnt = n.children ? n.children.length : 0
        fillCnt(n.children)
      }
    }
    fillCnt(labelSchema)

    const dimensionRowCount = Math.max(0, range.e.r - startRow + 1)
    totalRowCount += dimensionRowCount

    dimensions.push({
      name: sheetName,
      schema: labelSchema,
      rowCount: dimensionRowCount
    })
  }

  if (dimensions.length === 0) {
    throw new Error('没有找到有效的分类维度工作表')
  }

  return {
    dimensions,
    totalRowCount
  }
}

function sheetToFilledGrid(sheet: XLSX.WorkSheet): {
  grid: string[][]
  range: XLSX.Range
} {
  const range = XLSX.utils.decode_range(sheet['!ref'] as string)
  const rows = range.e.r - range.s.r + 1
  const cols = range.e.c - range.s.c + 1
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(''))

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = sheet[addr]
      if (!cell) continue
      const val = (cell.w ?? cell.v ?? '').toString().trim()
      grid[r - range.s.r][c - range.s.c] = val
    }
  }

  const merges: XLSX.Range[] = (sheet['!merges'] as XLSX.Range[]) || []
  for (const m of merges) {
    const base = grid[m.s.r - range.s.r][m.s.c - range.s.c]
    if (!base) continue
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        grid[r - range.s.r][c - range.s.c] = base
      }
    }
  }
  return { grid, range }
}

export function validateLabelFile(file: File): { valid: boolean; error?: string } {
  const allowedExt = ['.xlsx']
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!allowedExt.includes(ext)) {
    return { valid: false, error: `文件扩展名不支持，期望: ${allowedExt.join(', ')}` }
  }
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: `文件过大，最大 ${maxSize / 1024 / 1024}MB` }
  }
  return { valid: true }
}
