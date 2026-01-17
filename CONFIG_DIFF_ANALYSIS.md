# 开发和生产环境配置差异分析

## 发现的问题

### 问题 1: Prisma 连接管理（lib/db.ts）⚠️ **关键问题**

**当前代码**：
```typescript
export const db = globalThis.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db
}
```

**问题**：
- **生产环境没有使用全局实例**
- 每次导入 `lib/db.ts` 都会创建新的 PrismaClient
- 导致连接积累，10多分钟后连接池耗尽

**修复**：
```typescript
// 生产环境也要使用全局实例
if (!globalThis.prisma) {
  globalThis.prisma = db
}
```

### 问题 2: NextAuth 调试模式（lib/auth.ts）

**当前代码**：
```typescript
debug: process.env.NODE_ENV === "development",
```

**问题**：
- 生产环境关闭了调试模式
- 可能导致错误信息不完整
- 但这不是主要问题

**建议**：
- 暂时保持现状（生产环境不需要详细调试信息）
- 如果需要调试，可以临时开启

### 问题 3: NEXTAUTH_URL 配置

**开发环境**：`NEXTAUTH_URL=http://localhost:3000`
**生产环境**：`NEXTAUTH_URL=http://39.105.102.196:3000`

**检查**：
- 确保生产环境的 `NEXTAUTH_URL` 正确
- 确保与 `ecosystem.config.js` 中的配置一致

### 问题 4: Next.js 配置（next.config.mjs）

**当前配置**：
```javascript
experimental: {
  webpackBuildWorker: true,
  parallelServerBuildTraces: true,
  parallelServerCompiles: true,
  // Server Actions 已禁用，避免密钥不匹配问题
},
```

**问题**：
- 注释说"Server Actions 已禁用"，但实际上 Next.js 15 默认启用 Server Actions
- 这个配置可能无效

## 修复方案

### 修复 1: Prisma 连接管理（最重要）

修改 `lib/db.ts`：

```typescript
import { PrismaClient } from "@prisma/client"

declare global {
  var prisma: PrismaClient | undefined
}

// ⚠️ 修复：生产环境也要使用全局实例
export const db = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// 生产环境也要使用全局实例，避免连接积累
if (!globalThis.prisma) {
  globalThis.prisma = db
}

// 优雅关闭连接
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
```

### 修复 2: 验证 NEXTAUTH_URL

确保生产环境的 `NEXTAUTH_URL` 正确：

```bash
# 检查 .env 文件
grep NEXTAUTH_URL /root/crown-main/.env

# 检查 PM2 环境变量
pm2 env 0 | grep NEXTAUTH_URL

# 应该都是：NEXTAUTH_URL=http://39.105.102.196:3000
```

### 修复 3: 检查 NextAuth 配置

确保 `NEXTAUTH_SECRET` 正确：

```bash
# 检查 .env 文件
grep NEXTAUTH_SECRET /root/crown-main/.env

# 检查 PM2 环境变量
pm2 env 0 | grep NEXTAUTH_SECRET
```

## 为什么本地正常但服务器有问题？

### 开发环境（本地）
- `NODE_ENV !== "production"` → 使用全局 Prisma 实例 ✅
- 每次代码修改都会重新编译
- 连接会被正确管理

### 生产环境（服务器）
- `NODE_ENV === "production"` → **没有使用全局实例** ❌
- 每次导入都创建新的 PrismaClient
- 连接积累，10多分钟后耗尽

## 立即修复

最重要的修复是 `lib/db.ts`，这很可能是导致10多分钟后问题的根本原因。
