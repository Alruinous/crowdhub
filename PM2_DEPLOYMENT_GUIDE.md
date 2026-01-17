# PM2 部署完整指南

从零开始，使用 PM2 部署 Next.js 应用到 Linux 服务器。

## 📋 前置要求

- Linux 服务器（Ubuntu/CentOS/Debian 等）
- Node.js 18+ 已安装
- pnpm 已安装（或使用 npm）
- Git 已安装
- 服务器有公网 IP 或域名

## 🚀 完整部署步骤

### 步骤 1：克隆项目

```bash
# 进入工作目录
cd /root

# 克隆项目（替换为你的 GitHub 仓库地址）
git clone -b main --depth=1 https://github.com/Alruinous/crowdhub.git /root/crown-main

# 进入项目目录
cd crown-main
```

### 步骤 2：安装依赖

```bash
# 安装项目依赖
pnpm install

# 或者使用 npm
npm install --legacy-peer-deps
```

### 步骤 3：配置环境变量

```bash
# 创建 .env 文件
nano .env
```

在 `.env` 文件中添加以下内容：

```env
# NextAuth 认证配置
NEXTAUTH_URL=http://你的服务器IP或域名:3000
# 生成密钥：openssl rand -base64 48
NEXTAUTH_SECRET=xJGZ+/aKc4IsRSzE2BPdCSH9ZxyAXm3R09506JYHOibV4HBrbw86roP0+eF1EVjY

# Server Actions 加密密钥（重要！）
# 生成密钥：openssl rand -base64 32
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=KvbqeW/sX/7wfasNxOL5enuB1WJK/U0vcI172AJY5j4=

# 数据库配置（SQLite）
DATABASE_URL="file:./dev.db"

# 其他配置（根据项目需要）
USE_MINUTE_CYCLE=false
CRON_SCHEDULE="0 0 0 * * *"
```

**生成密钥命令**：

```bash
# 生成 NEXTAUTH_SECRET（48 字节）
openssl rand -base64 48

# 生成 NEXT_SERVER_ACTIONS_ENCRYPTION_KEY（32 字节）
openssl rand -base64 32
```

### 步骤 4：初始化数据库

```bash
# 运行数据库迁移
pnpm db:migrate

# 或者重置数据库（会删除所有数据）
pnpm db:reset
```

### 步骤 5：安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2

# 验证安装
pm2 --version
```

### 步骤 6：创建 PM2 配置文件

```bash
# 在项目根目录创建 ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crown-main',
    script: 'pnpm',
    args: 'start',
    cwd: '/root/crown-main',
    
    // 自动加载 .env 文件（关键！）
    env_file: '/root/crown-main/.env',
    
    // 环境变量（env_file 会覆盖这些，但可以设置默认值）
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    
    // 进程配置
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    
    // 资源限制
    max_memory_restart: '1G',
    
    // 日志配置
    error_file: '/root/crown-main/logs/pm2-error.log',
    out_file: '/root/crown-main/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 自动重启配置
    autorestart: true,        // 自动重启（关键！）
    max_restarts: 50,         // 最大重启次数（建议设置较大值，或移除限制）
    min_uptime: '10s',        // 最小运行时间（10秒内崩溃会触发重启保护）
    restart_delay: 4000,      // 重启延迟（毫秒）
    exp_backoff_restart_delay: 100,  // 指数退避重启延迟（可选）
    
    // 其他配置
    kill_timeout: 5000,
    listen_timeout: 3000,
  }]
}
EOF
```

**注意**：将 `/root/crown-main` 替换为你的实际项目路径。

**重要配置说明**：

- ✅ `autorestart: true` - 自动重启（必需）
- ⚠️ `max_restarts: 10` - 最大重启次数限制（建议改为更大的值或移除）
- ✅ `min_uptime: '10s'` - 最小运行时间（防止快速崩溃循环）
- ✅ `restart_delay: 4000` - 重启延迟（避免频繁重启）

**优化建议**：对于生产环境，建议移除 `max_restarts` 限制或设置为更大的值（如 50 或 100），确保应用能够持续运行。

### 步骤 7：创建日志目录

```bash
# 创建日志目录
mkdir -p /root/crown-main/logs

# 设置权限（如果需要）
chmod 755 /root/crown-main/logs
```

### 步骤 8：构建应用（重要：确保环境变量被读取）

**关键**：Next.js 15 默认启用 Server Actions，无法通过配置禁用。必须确保环境变量在构建和运行时都正确加载。

```bash
# 进入项目目录
cd /root/crown-main

# 方法 1：手动加载环境变量并构建（推荐）
source .env

# 验证环境变量（重要！）
echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:0:10}..."

# 构建应用（构建时会读取环境变量）
pnpm build

# 验证构建是否成功
ls -la .next/server/server-reference-manifest.json

# 验证密钥是否被嵌入
cat .next/server/server-reference-manifest.json | grep encryptionKey
```

**如果环境变量未加载，构建时会使用随机密钥，导致后续不匹配！**

### 步骤 9：启动 PM2

```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs crown-main

# 查看详细信息
pm2 describe crown-main
```

### 步骤 10：设置开机自启

```bash
# 生成开机自启脚本
pm2 startup

# 按照输出的提示执行命令（通常是 sudo 开头的命令）

# 保存当前 PM2 进程列表
pm2 save
```

### 步骤 11：验证部署

```bash
# 1. 检查 PM2 状态
pm2 status

# 2. 检查进程是否运行
ps aux | grep "next-server"

# 3. 检查端口是否监听
netstat -tlnp | grep 3000
# 或
ss -tlnp | grep 3000

# 4. 检查环境变量
pm2 env 0 | grep NEXT_SERVER_ACTIONS

# 5. 查看实时日志
pm2 logs crown-main --lines 50

# 6. 测试应用（在浏览器中访问）
# http://你的服务器IP:3000
```

## 🔧 PM2 常用命令

### 进程管理

```bash
# 启动应用
pm2 start ecosystem.config.js

# 停止应用
pm2 stop crown-main

# 重启应用
pm2 restart crown-main

# 删除应用
pm2 delete crown-main

# 查看状态
pm2 status

# 查看详细信息
pm2 describe crown-main
```

### 日志管理

```bash
# 查看实时日志
pm2 logs crown-main

# 查看最近 100 行日志
pm2 logs crown-main --lines 100

# 清空日志
pm2 flush

# 查看错误日志
pm2 logs crown-main --err

# 查看输出日志
pm2 logs crown-main --out
```

### 监控和管理

```bash
# 实时监控
pm2 monit

# 查看进程信息
pm2 info crown-main

# 查看环境变量
pm2 env 0

# 重新加载配置（不重启）
pm2 reload ecosystem.config.js

# 查看资源使用情况
pm2 list
```

### 更新部署

```bash
# 1. 停止应用
pm2 stop crown-main

# 2. 拉取最新代码
cd /root/crown-main
git pull

# 3. 安装新依赖（如果有）
pnpm install

# 4. 运行数据库迁移（如果有）
pnpm db:migrate

# 5. 重新构建（确保环境变量已加载）
source .env
pnpm build

# 6. 重启应用
pm2 restart crown-main

# 7. 查看日志确认
pm2 logs crown-main --lines 50
```

## 🔍 故障排查

### 问题 1：应用无法启动

```bash
# 查看错误日志
pm2 logs crown-main --err

# 查看 PM2 状态
pm2 status

# 检查环境变量
pm2 env 0

# 手动测试启动
cd /root/crown-main
source .env
pnpm start
```

### 问题 2：环境变量未加载

```bash
# 检查 .env 文件是否存在
ls -la /root/crown-main/.env

# 检查 ecosystem.config.js 中的 env_file 路径是否正确
cat ecosystem.config.js | grep env_file

# 手动验证环境变量
cd /root/crown-main
source .env
echo $NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

# 检查 PM2 进程的环境变量
pm2 env 0 | grep NEXT_SERVER_ACTIONS
```

### 问题 3：端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep 3000

# 或
ss -tlnp | grep 3000

# 杀死占用端口的进程
kill -9 <PID>

# 或修改端口（在 .env 文件中）
PORT=3001
```

### 问题 4：构建失败

```bash
# 检查构建日志
pnpm build

# 检查环境变量是否在构建时被读取
source .env
echo $NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
pnpm build

# 清理后重新构建
rm -rf .next
pnpm build
```

### 问题 5：Server Actions 错误（仍然出现）

**重要**：Next.js 15 默认启用 Server Actions，无法通过配置禁用。必须确保环境变量在构建和运行时都正确加载。

#### 为什么运行时环境变量未加载，但短时间内还能正常工作？

**关键机制**：

1. **启动时（短时间内正常）**：
   - Next.js 启动时从构建产物（manifest）中读取密钥
   - 使用构建时嵌入的密钥来处理初始请求
   - 此时即使运行时没有环境变量，也能正常工作

2. **运行一段时间后（出现问题）**：
   - 某些操作触发了新的 Server Actions 请求
   - Next.js 需要生成新的 Server Actions 标识符
   - **此时需要运行时环境变量来生成/验证这些标识符**
   - 如果没有运行时环境变量，Next.js 可能会：
     - 生成随机密钥（与构建时的密钥不匹配）
     - 导致验证失败
     - 出现 `Failed to find Server Action` 错误

3. **为什么是"一段时间后"**：
   - 初始请求使用构建时嵌入的密钥
   - 某些操作（如登录、表单提交、动态路由）会触发新的 Server Actions
   - 这些新请求需要运行时环境变量来验证
   - 如果没有，就会失败

**总结**：
- ✅ 构建时有密钥 → 启动时能正常工作
- ❌ 运行时没有密钥 → 新请求验证失败
- ⏰ 一段时间后 → 触发新请求 → 验证失败 → 错误出现

#### 诊断步骤

```bash
# 1. 检查运行时环境变量
pm2 env 0 | grep NEXT_SERVER_ACTIONS

# 2. 检查构建产物中的密钥
cat .next/server/server-reference-manifest.json | grep encryptionKey

# 3. 确认 .env 文件中的密钥
grep NEXT_SERVER_ACTIONS_ENCRYPTION_KEY .env

# 4. 检查 PM2 的 env_file 是否工作
pm2 describe crown-main | grep env_file
```

#### 解决方案 A：确保构建时环境变量被读取

```bash
# 1. 停止应用
pm2 stop crown-main

# 2. 清理构建产物
rm -rf .next

# 3. 确保环境变量已加载（重要！）
cd /root/crown-main
source .env

# 4. 验证环境变量
echo "密钥长度: ${#NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}"

# 5. 重新构建（在环境变量已加载的情况下）
pnpm build

# 6. 验证密钥是否被嵌入
cat .next/server/server-reference-manifest.json | grep encryptionKey

# 7. 重启应用
pm2 restart crown-main
```

#### 解决方案 B：修改 PM2 配置，显式设置环境变量

如果 `env_file` 不工作，可以在 `ecosystem.config.js` 中显式设置：

```javascript
module.exports = {
  apps: [{
    name: 'crown-main',
    script: 'pnpm',
    args: 'start',
    cwd: '/root/crown-main',
    
    // 显式设置环境变量（如果 env_file 不工作）
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'KvbqeW/sX/7wfasNxOL5enuB1WJK/U0vcI172AJY5j4=',
      // 从 .env 文件复制其他环境变量
    },
    
    // ... 其他配置
  }]
}
```

**注意**：将密钥值替换为你实际的密钥。

#### 解决方案 C：使用构建脚本确保环境变量

创建一个构建脚本：

```bash
cat > /root/crown-main/build.sh << 'EOF'
#!/bin/bash
set -e
cd /root/crown-main
source .env
echo "🔍 构建时环境变量检查:"
echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY 长度: ${#NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}"
pnpm build
EOF

chmod +x /root/crown-main/build.sh
```

然后使用脚本构建：

```bash
/root/crown-main/build.sh
pm2 restart crown-main
```

## 📊 性能优化建议

### 1. 资源限制

在 `ecosystem.config.js` 中设置：

```javascript
max_memory_restart: '1G',  // 内存超过 1G 自动重启
```

### 2. 多实例部署（如果需要）

```javascript
instances: 2,  // 使用 2 个实例
exec_mode: 'cluster',  // 集群模式
```

**注意**：Next.js 应用通常使用 `fork` 模式，而不是 `cluster` 模式。

### 3. 日志轮转

```bash
# 安装 PM2 日志轮转模块
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 🔒 安全建议

### 1. 保护 .env 文件

```bash
# 设置文件权限
chmod 600 /root/crown-main/.env

# 确保 .env 在 .gitignore 中
echo ".env" >> .gitignore
```

### 2. 使用非 root 用户（推荐）

```bash
# 创建专用用户
sudo useradd -m -s /bin/bash appuser

# 将项目目录所有权转移
sudo chown -R appuser:appuser /root/crown-main

# 使用 appuser 运行 PM2
su - appuser
pm2 start ecosystem.config.js
```

### 3. 配置防火墙

```bash
# 只开放必要端口
sudo ufw allow 3000/tcp
sudo ufw enable
```

## 📝 完整部署脚本示例

创建一个自动化部署脚本：

```bash
cat > /root/crown-main/deploy.sh << 'EOF'
#!/bin/bash

set -e  # 遇到错误立即退出

echo "🚀 开始部署..."

# 1. 进入项目目录
cd /root/crown-main

# 2. 拉取最新代码
echo "📥 拉取最新代码..."
git pull

# 3. 安装依赖
echo "📦 安装依赖..."
pnpm install

# 4. 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
pnpm db:migrate || true

# 5. 加载环境变量并构建
echo "🔨 构建应用..."
source .env
pnpm build

# 6. 重启 PM2
echo "🔄 重启应用..."
pm2 restart crown-main

# 7. 查看状态
echo "✅ 部署完成！"
pm2 status
pm2 logs crown-main --lines 20
EOF

# 设置执行权限
chmod +x /root/crown-main/deploy.sh
```

使用部署脚本：

```bash
/root/crown-main/deploy.sh
```

## ✅ 验证清单

部署完成后，检查以下项目：

- [ ] PM2 进程正在运行（`pm2 status`）
- [ ] 端口 3000 正在监听（`netstat -tlnp | grep 3000`）
- [ ] 环境变量已加载（`pm2 env 0 | grep NEXT_SERVER_ACTIONS`）
- [ ] 应用可以访问（浏览器访问 `http://服务器IP:3000`）
- [ ] 日志正常（`pm2 logs crown-main`）
- [ ] 没有 Server Actions 错误（观察日志）
- [ ] 开机自启已配置（`pm2 save` 已执行）

## 🎯 总结

使用 PM2 部署的优势：

1. ✅ **简单配置**：`env_file` 自动加载 `.env` 文件
2. ✅ **环境一致**：构建和运行使用相同的环境变量
3. ✅ **自动管理**：自动重启、日志管理
4. ✅ **易于监控**：内置监控和日志功能
5. ✅ **避免问题**：不需要区分构建时和运行时环境变量

**关键点**：
- 确保 `.env` 文件包含 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- 构建前加载环境变量（`source .env`）
- 使用 `env_file` 选项自动加载环境变量
- 定期检查日志，确保没有错误

## 📚 参考资源

- [PM2 官方文档](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [Next.js Server Actions](https://nextjs.org/docs/app/api-reference/functions/server-actions)
