# 科普众包系统

一个基于 Next.js 的全栈科普任务协作平台，支持任务发布、分解、认领和沟通功能。

## 🚀 快速开始

### 环境要求
- **Node.js**: 18+ (推荐)
- **包管理器**: npm 或 pnpm

### 完整启动步骤

#### 1. 环境检查
```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本  
npm --version
```

#### 2. 安装依赖
```bash
# 使用 npm 安装（推荐）
npm install --legacy-peer-deps

# 或使用 pnpm（如果已安装）
pnpm install
```

> **注意**: 由于 React 版本冲突，必须使用 `--legacy-peer-deps` 标志

#### 3. 环境配置
创建或检查 `.env` 文件：
```env
# NextAuth 认证配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secure-secret-key-here

# 数据库配置（SQLite）
DATABASE_URL="file:./dev.db"
```

> **安全提醒**: 生成真正的随机密钥替换示例值：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 4. 数据库初始化
```bash
# 重置数据库（推荐用于首次启动）
npm run db:reset
```

这个命令会自动：
- ❌ 删除现有数据库
- ✅ 重新创建数据库结构
- ✅ 应用所有迁移
- ✅ 自动运行种子数据填充

#### 5. 启动开发服务器
```bash
npm run dev
```

#### 6. 访问应用
打开浏览器访问：**http://localhost:3000**

## 🔑 测试账户

系统预置了三个测试账户（密码均为 `000000`）：

| 角色 | 邮箱 | 权限说明 |
|------|------|----------|
| 管理员 | `admin@raids.io` | 完整系统管理权限 |
| 发布者 | `publisher@raids.io` | 发布和管理任务 |
| 接单者 | `worker@raids.io` | 认领和完成任务 |

## 🏗️ 项目架构

### 技术栈
- **前端**: Next.js 15 + React 18 + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + Prisma + SQLite
- **认证**: NextAuth.js
- **UI组件**: Radix UI
- **状态管理**: TanStack Query

### 目录结构
```
crown-main/
├── app/              # Next.js App Router（页面 + API）
├── components/       # React 可复用组件
├── lib/             # 工具函数和配置
├── prisma/          # 数据库相关
├── hooks/           # 自定义 React Hooks
├── types/           # TypeScript 类型定义
└── public/          # 静态资源
```

## 📊 核心功能

### 用户系统
- 三种角色权限（管理员、发布者、接单者）
- 积分奖励系统
- 用户封禁管理

### 任务系统
- 主任务发布和分解
- 子任务认领和完成
- 任务状态管理
- AI 辅助任务分解

### 沟通系统
- 任务相关实时聊天
- 发布者与接单者直接沟通

### 管理系统
- 用户管理
- 任务审核
- 分类管理
- AI 配置管理

## 🛠️ 开发命令

### 常用命令
```bash
# 开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start

# 代码检查
npm run lint
```

### 数据库命令
```bash
# 数据库迁移
npm run db:migrate

# 重置数据库（删除所有数据）
npm run db:reset

# 填充初始数据
npm run db:seed

# 打开数据库管理界面
npx prisma studio
```

## ⚠️ 常见问题

### 依赖冲突解决
如果遇到依赖冲突错误：
```bash
# 方案1：使用 legacy-peer-deps（推荐）
npm install --legacy-peer-deps

# 方案2：降级 React 版本（彻底解决）
# 修改 package.json 中的 React 版本为 ^18.2.0
```

### 开发服务器警告
启动时可能出现 SWC 依赖警告：
```bash
# 修复警告
npm install
```

### 热重载功能
- 修改代码后自动重新编译
- 无需手动重启服务器
- 支持前端组件、样式、API 路由的即时更新

## 🔧 故障排除

### 端口占用
如果 3000 端口被占用：
```bash
# 查看占用端口的进程
netstat -ano | findstr :3000

# 终止进程（替换 PID）
taskkill /PID <PID> /F
```

### 数据库问题
```bash
# 重新生成 Prisma 客户端
npx prisma generate

# 重置数据库
npm run db:reset
```

### 缓存清理
```bash
# 删除 node_modules 和锁定文件
rmdir /s /q node_modules
del package-lock.json

# 重新安装
npm install
```

## 📝 开发说明

### 代码修改
- 支持热重载，修改后自动更新
- 修改环境变量或配置文件需要重启服务器
- 数据库模型修改后需要重新生成客户端

### 数据库操作
- 使用 Prisma Studio 查看和管理数据：`npx prisma studio`
- 数据库文件位置：`prisma/dev.db`
- 迁移文件位置：`prisma/migrations/`

### 部署准备
生产环境需要：
1. 修改 `.env` 中的密钥和数据库配置
2. 运行 `npm run build`
3. 使用 `npm run start` 启动生产服务器

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

---

**提示**: 本项目已成功配置并运行在您的本地环境中！您现在可以开始探索和开发了。
