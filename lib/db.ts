import { PrismaClient } from "@prisma/client"

declare global {
  var prisma: PrismaClient | undefined
}

// ⚠️ 修复：生产环境也要使用全局实例，避免连接积累
export const db = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// 生产环境也要使用全局实例，避免每次导入都创建新连接
if (!globalThis.prisma) {
  globalThis.prisma = db
}

// 优雅关闭连接（生产环境）
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await db.$disconnect()
  })
  
  process.on('SIGINT', async () => {
    await db.$disconnect()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    await db.$disconnect()
    process.exit(0)
  })
}
