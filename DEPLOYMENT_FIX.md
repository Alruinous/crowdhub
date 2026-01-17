# 部署问题修复指南

## 问题描述
部署后10分钟左右出现 Server Actions 缓存错误：
- `Failed to find Server Action "x"`
- `This request might be from an older or newer deployment`
- 前端出现 403 Forbidden 错误

## 根本原因

根据 Next.js 官方文档，这个问题的根本原因是：

**Next.js Server Actions 加密密钥机制：**
- Next.js 会为 Server Actions 创建加密的、非确定性的密钥（ID）
- 这些密钥在**每次构建之间会重新计算**，以增强安全性
- 当重新构建后，旧的客户端请求（使用旧的密钥）无法匹配新的服务器（使用新的密钥）
- 导致错误：`Failed to find Server Action "x"` 和 `This request might be from an older or newer deployment`

**为什么10分钟后才出现？**
- 可能是某些缓存过期
- 或者有新的请求触发了不匹配的密钥验证

## 解决方案（推荐）

### 方案一：设置固定的 Server Actions 加密密钥（官方推荐）

这是 Next.js 官方推荐的解决方案，通过设置环境变量 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 来固定加密密钥。

#### 1. 生成加密密钥

在服务器上运行以下命令生成一个 AES-GCM 格式的加密密钥：

```bash
# 生成 32 字节的随机密钥（Base64 编码）
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

或者使用 OpenSSL：

```bash
openssl rand -base64 32
```

#### 2. 将密钥添加到环境变量

编辑 `/root/crown-main/.env` 文件，添加：

```env
# Server Actions 加密密钥（固定密钥，避免每次构建后密钥不匹配）
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=你生成的密钥（Base64字符串）
```

**重要提示：**
- 这个密钥必须保密，不要提交到 Git
- 一旦设置，不要随意更改（除非有安全需要）
- 所有服务器实例必须使用相同的密钥

#### 2.1 环境变量如何被使用？

**关键点：你不需要在代码中显式调用这个环境变量！**

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 是 **Next.js 框架内部自动使用的环境变量**：

1. **构建时嵌入**（重要！）：
   - 密钥在 **构建时**（`pnpm build`）被读取并嵌入到构建产物中
   - 不是运行时读取，而是构建时写入到 JavaScript bundle 中
   - 这意味着：**必须重新构建才能使用新的密钥**

2. **浏览器如何获取密钥？**
   - 浏览器加载页面时，会下载服务器生成的 JavaScript bundle
   - Bundle 中包含了使用固定密钥加密的 Server Actions 标识符
   - 浏览器使用这些标识符来调用 Server Actions

3. **工作流程：**
   ```
   设置环境变量 → 重新构建 → 密钥嵌入到 bundle → 重启服务 → 
   浏览器加载新 bundle → 使用新密钥 → 与服务器匹配 ✅
   ```

4. **为什么需要重新构建？**
   - 旧的构建产物（`.next` 目录）中仍然包含旧的密钥
   - 只重启服务不重新构建，浏览器仍然会加载旧的 bundle（使用旧密钥）
   - 必须重新构建，新的 bundle 才会包含新的固定密钥

5. **你的 systemd 配置已经包含构建步骤：**
   ```ini
   ExecStartPre=/root/.nvm/versions/node/v23.11.0/bin/pnpm build
   ```
   这意味着每次 `systemctl restart` 都会自动重新构建，所以：
   - ✅ 设置环境变量
   - ✅ 重启服务（会自动构建）
   - ✅ 浏览器刷新页面（加载新的 bundle）

6. **即使代码中没有 "use server" 指令也会使用**
   - Next.js 15 在某些内部机制中会使用 Server Actions
   - 即使你使用的是传统的 API Routes（`/api/xxx`），Next.js 框架层面仍可能使用 Server Actions 机制
   - 你的错误日志明确显示了 Server Actions 相关错误，说明确实在使用

**验证环境变量是否生效：**

1. **检查 systemd 环境变量配置（你刚才执行的）：**
```bash
sudo systemctl show crown-main | grep Environment
```
输出应该包含：
```
EnvironmentFiles=/root/crown-main/.env (ignore_errors=no)
```
这表示 systemd 会从 `.env` 文件加载环境变量 ✅

2. **验证环境变量是否在构建时被读取：**
```bash
# 查看最近的构建日志
sudo journalctl -u crown-main --since "10 minutes ago" | grep -i "build\|encryption\|server.*action"

# 或者查看完整的服务日志
sudo journalctl -u crown-main -n 200 | grep -i "build"
```

3. **验证 .env 文件中确实有密钥：**
```bash
# 检查 .env 文件是否包含密钥（不显示完整值）
grep -q "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" /root/crown-main/.env && echo "✅ 密钥已配置" || echo "❌ 密钥未配置"
```

4. **最直接的验证方法 - 测试应用是否正常工作：**
```bash
# 重启服务后，观察日志中是否有 Server Actions 错误
sudo systemctl restart crown-main
sudo journalctl -u crown-main -f

# 然后在浏览器中访问应用，执行一些操作
# 如果不再出现 "Failed to find Server Action" 错误，说明修复成功 ✅
```

#### 3. 更新 systemd 配置文件（可选但推荐）

同时更新 `/etc/systemd/system/crown-main.service`，在构建前完全清理 `.next` 目录：

修改 `/etc/systemd/system/crown-main.service`，在构建前完全清理 `.next` 目录：

```ini
[Unit]
Description=Crown Main Application (Node.js v23.11.0)
After=network.target

[Service]
User=root
WorkingDirectory=/root/crown-main
EnvironmentFile=/root/crown-main/.env
Environment="PATH=/root/.nvm/versions/node/v23.11.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# 完全清理 .next 目录（包括所有缓存和构建产物）
ExecStartPre=/bin/bash -c 'rm -rf /root/crown-main/.next || true'
# 执行构建
ExecStartPre=/root/.nvm/versions/node/v23.11.0/bin/pnpm build

# 启动应用
ExecStart=/root/.nvm/versions/node/v23.11.0/bin/pnpm start
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=crown-main

[Install]
WantedBy=multi-user.target
```

#### 4. 重新加载并重启服务

```bash
# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 重启服务（会自动执行构建，使用新的环境变量）
sudo systemctl restart crown-main

# 查看服务状态
sudo systemctl status crown-main

# 查看日志（确认构建成功）
sudo journalctl -u crown-main -f
```

**重要说明：**
- `systemctl restart` 会触发 `ExecStartPre` 中的构建命令
- 构建时会读取 `.env` 文件中的 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- 新的密钥会被嵌入到构建产物中
- 浏览器刷新页面后，会加载新的 bundle，使用新的固定密钥
- 之后即使重新构建，只要使用相同的密钥，浏览器和服务器就能始终匹配

### 方案二：完全清理构建目录（备选方案）

如果不想设置固定密钥，可以确保每次构建前完全清理 `.next` 目录：

```bash
# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 重启服务
sudo systemctl restart crown-main

# 查看服务状态
sudo systemctl status crown-main

# 查看日志
sudo journalctl -u crown-main -f
```

### 验证修复

部署后观察日志，确认：
- 没有 Server Actions 相关错误
- 前端请求正常（不再出现 403）
- 应用稳定运行超过10分钟

部署后观察日志，确认：
- 没有 Server Actions 相关错误
- 前端请求正常（不再出现 403）
- 应用稳定运行超过10分钟

## 两种方案对比

### 方案一：固定加密密钥（推荐）✅
- **优点**：
  - 官方推荐方案
  - 解决根本问题（密钥不一致）
  - 不需要每次完全清理构建目录，构建更快
  - 支持多服务器部署时保持一致性
- **缺点**：
  - 需要管理额外的密钥
  - 密钥泄露会有安全风险

### 方案二：完全清理构建目录
- **优点**：
  - 简单直接
  - 不需要额外配置
- **缺点**：
  - 每次构建时间更长
  - 如果构建过程中出现问题，可能仍有残留

## 推荐做法

**最佳实践：同时使用两种方案**
1. 设置 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 环境变量（解决根本问题）
2. 在构建前清理 `.next` 目录（确保构建干净）

这样可以：
- 从根本上解决密钥不匹配问题
- 确保每次构建都是全新的
- 提高部署的可靠性

## 注意事项

1. **密钥安全**：
   - `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 必须保密
   - 不要提交到 Git 仓库
   - 生产环境和开发环境可以使用不同的密钥

2. **构建时间**：
   - 完全清理 `.next` 目录会增加构建时间
   - 如果使用固定密钥，可以只清理缓存：`rm -rf /root/crown-main/.next/cache`

3. **磁盘空间**：确保有足够的磁盘空间用于构建

4. **多服务器部署**：
   - 所有服务器实例必须使用相同的 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
   - 这是确保 Server Actions 在不同服务器间正常工作的关键

## 故障排查

如果设置固定密钥后问题仍然存在，按以下步骤排查：

### 问题 1：构建时环境变量未读取（最常见）

**症状**：设置了 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 但问题仍然存在

**原因**：systemd 的 `ExecStartPre` 可能不会自动继承 `EnvironmentFile` 的环境变量

**解决方案**：修改 systemd 配置，确保构建时能读取环境变量

编辑 `/etc/systemd/system/crown-main.service`：

```ini
[Unit]
Description=Crown Main Application (Node.js v23.11.0)
After=network.target

[Service]
User=root
WorkingDirectory=/root/crown-main
EnvironmentFile=/root/crown-main/.env
Environment="PATH=/root/.nvm/versions/node/v23.11.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# 完全清理 .next 目录
ExecStartPre=/bin/bash -c 'rm -rf /root/crown-main/.next || true'

# 关键修复：使用 bash -c 并显式加载环境变量后再构建
ExecStartPre=/bin/bash -c 'set -a && source /root/crown-main/.env && set +a && cd /root/crown-main && /root/.nvm/versions/node/v23.11.0/bin/pnpm build'

# 启动应用
ExecStart=/root/.nvm/versions/node/v23.11.0/bin/pnpm start
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=crown-main

[Install]
WantedBy=multi-user.target
```

**关键变更**：
- 将构建命令改为：`/bin/bash -c 'set -a && source /root/crown-main/.env && set +a && cd /root/crown-main && /root/.nvm/versions/node/v23.11.0/bin/pnpm build'`
- `set -a`：自动导出所有变量
- `source /root/crown-main/.env`：加载 .env 文件
- `set +a`：关闭自动导出

然后执行：
```bash
sudo systemctl daemon-reload
sudo systemctl restart crown-main
```

### 问题 2：浏览器缓存

**症状**：服务器已更新，但浏览器仍然报错

**解决方案**：
1. **强制刷新浏览器缓存**：
   - Chrome/Edge: `Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)
   - Firefox: `Ctrl + F5` (Windows) 或 `Cmd + Shift + R` (Mac)
2. **清除浏览器缓存**：
   - 打开开发者工具 (F12)
   - 右键点击刷新按钮
   - 选择"清空缓存并硬性重新加载"
3. **使用无痕模式测试**：确认是否是缓存问题

### 问题 3：多个进程运行

**检查方法**：
```bash
# 检查是否有多个 Node.js 进程
ps aux | grep node | grep -v grep

# 检查是否有多个 pnpm 进程
ps aux | grep pnpm | grep -v grep

# 如果有多个进程，停止所有相关进程
sudo systemctl stop crown-main
pkill -f "next-server"
pkill -f "pnpm"
sudo systemctl start crown-main
```

### 问题 4：验证环境变量是否在构建时被读取

**测试方法**：
```bash
# 方法1：手动测试构建时是否能读取环境变量
cd /root/crown-main
source .env
echo $NEXT_SERVER_ACTIONS_ENCRYPTION_KEY  # 应该能输出密钥

# 方法2：在构建命令中添加调试输出（临时）
# 修改 systemd 配置中的构建命令，添加：
# ExecStartPre=/bin/bash -c 'source /root/crown-main/.env && echo "Key length: ${#NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}" && /root/.nvm/versions/node/v23.11.0/bin/pnpm build'
```

### 问题 5：确认密钥格式正确

```bash
# 检查密钥格式
grep NEXT_SERVER_ACTIONS_ENCRYPTION_KEY /root/crown-main/.env

# 密钥应该是：
# - Base64 编码的字符串
# - 32 字节（Base64 编码后约 44 个字符，包括 = 结尾）
# - 格式：NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=xxxxx...xxxxx=
```

### 问题 6：查看详细构建日志

```bash
# 查看完整的构建日志
sudo journalctl -u crown-main --since "1 hour ago" | grep -A 50 "ExecStartPre.*build"

# 查看是否有构建错误
sudo journalctl -u crown-main --since "1 hour ago" | grep -i "error\|fail"
```

### 问题 7：设置密钥后仍然出现错误（运行一段时间后）

**症状**：已经设置了 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 并重新构建，但运行一段时间后（如30分钟）仍然出现错误

**关键观察**：重启后短时间内能正常访问，说明此时浏览器和服务器的密钥是对应的。但之后又会出现错误。

**为什么会出现这种情况？**

#### 原因分析

1. **运行时环境变量未设置（最可能）**
   - ✅ 构建时：密钥被读取并嵌入到 manifest 中
   - ❌ 运行时：Next.js 在验证 Server Actions 时，如果没有环境变量，可能会：
     - 回退到生成随机密钥
     - 使用不同的密钥验证机制
     - 导致与构建时的密钥不匹配

2. **Next.js 的运行时密钥验证机制**
   - 构建时：密钥嵌入到 manifest，用于生成 Server Actions 标识符
   - 运行时：Next.js 需要读取环境变量来验证这些标识符
   - 如果运行时没有环境变量，验证会失败

3. **浏览器缓存问题**
   - 浏览器可能在不同时间加载了不同版本的 bundle
   - 某些操作触发了新的 Server Actions 请求，使用了旧的密钥

4. **Next.js 的模块热重载/缓存机制**
   - Next.js 可能在运行一段时间后重新加载某些模块
   - 如果运行时没有环境变量，重新加载时可能使用不同的密钥

**可能原因**：
1. **运行时环境变量未设置**（最可能）⭐
2. **浏览器仍然使用旧的 bundle**（部分页面/操作）
3. **Next.js 15 的运行时缓存问题**
4. **多个构建版本混合**

**解决方案**：

#### 方案 A：强制浏览器刷新（首先尝试）

```bash
# 1. 确保服务器已重新构建并重启
sudo systemctl restart crown-main

# 2. 在浏览器中：
# - 按 Ctrl + Shift + Delete（清除浏览器缓存）
# - 或者使用无痕模式 + 强制刷新（Ctrl + Shift + R）
# - 或者清除所有站点数据
```

#### 方案 B：验证构建产物是否包含密钥

```bash
# 检查构建产物中是否包含 Server Actions 相关文件
find /root/crown-main/.next -name "*server*" -type f | head -10

# 检查构建时间（确认是新构建的）
ls -la /root/crown-main/.next/server

# 查看构建日志，确认构建成功
sudo journalctl -u crown-main --since "1 hour ago" | grep -i "build\|compiled\|ready"
```

#### 方案 C：添加运行时环境变量（双重保障）

虽然密钥应该在构建时嵌入，但也可以尝试在运行时也设置：

编辑 `/etc/systemd/system/crown-main.service`：

```ini
[Service]
User=root
WorkingDirectory=/root/crown-main
EnvironmentFile=/root/crown-main/.env
Environment="PATH=/root/.nvm/versions/node/v23.11.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
# 显式设置环境变量（双重保障）
Environment="NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=KvbqeW/sX/7wfasNxOL5enuB1WJK/U0vcI172AJY5j4="

# 完全清理 .next 目录
ExecStartPre=/bin/bash -c 'rm -rf /root/crown-main/.next || true'

# 构建时加载环境变量
ExecStartPre=/bin/bash -c 'set -a && source /root/crown-main/.env && set +a && cd /root/crown-main && /root/.nvm/versions/node/v23.11.0/bin/pnpm build'

# 启动应用
ExecStart=/root/.nvm/versions/node/v23.11.0/bin/pnpm start
```

**注意**：将 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=KvbqeW/sX/7wfasNxOL5enuB1WJK/U0vcI172AJY5j4=` 替换为你实际的密钥值。

#### 方案 D：禁用 Server Actions（如果不需要）

如果项目中没有显式使用 Server Actions，可以尝试禁用：

编辑 `next.config.mjs`：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... 其他配置
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    // 尝试移除或注释掉 serverActions
    // serverActions: {}, 
  },
}
```

**注意**：这可能会影响 Next.js 15 的某些功能，谨慎使用。

#### 方案 E：检查是否有多个 Next.js 进程

```bash
# 检查是否有多个 next-server 进程
ps aux | grep "next-server" | grep -v grep

# 如果有多个，停止所有并重启
sudo systemctl stop crown-main
pkill -f "next-server"
sudo systemctl start crown-main
```

### 问题 8：检查浏览器使用的密钥（诊断密钥不一致问题）

**目的**：确认浏览器使用的密钥是否与服务器一致

**方法 1：查看浏览器加载的 JavaScript Bundle（推荐）**

1. **打开浏览器开发者工具**（F12）
2. **切换到 Network 标签**
3. **刷新页面**（F5）
4. **查找并打开 `_next/static/chunks/` 下的 JavaScript 文件**
5. **在文件中搜索 `server-reference-manifest` 或 `encryptionKey`**

或者直接在浏览器控制台执行：

```javascript
// 在浏览器控制台执行
fetch('/_next/static/chunks/server-reference-manifest.json')
  .then(r => r.json())
  .then(data => {
    console.log('🔍 浏览器使用的密钥:', data.encryptionKey);
    console.log('🔍 密钥长度:', data.encryptionKey?.length);
  })
  .catch(err => console.error('无法获取 manifest:', err));
```

**方法 2：查看 Server Actions 请求中的加密标识符**

1. **打开浏览器开发者工具**（F12）
2. **切换到 Network 标签**
3. **触发一个会使用 Server Actions 的操作**（如登录、提交表单等）
4. **查找 POST 请求到 `/` 或包含 `?__rsc` 的请求**
5. **查看请求的 Payload 或 Headers**

Server Actions 请求通常包含加密的标识符，这些标识符是基于密钥生成的。

**方法 3：检查服务器上的静态文件结构**

```bash
# 查找所有 manifest 相关文件
find /root/crown-main/.next -name "*manifest*" -type f

# 检查静态文件目录
ls -la /root/crown-main/.next/static/chunks/ | head -20

# 检查构建时间戳（确认是否是新构建）
ls -la /root/crown-main/.next/static/chunks/*.js | head -5
```

**注意**：Next.js 15 可能将密钥嵌入到 JavaScript bundle 中，而不是单独的 manifest 文件。

**方法 3.1：通过检查构建时间戳确认浏览器是否使用新 bundle**

在浏览器开发者工具的 Network 标签中：
1. 刷新页面（F5）
2. 查看加载的 JavaScript 文件（如 `2342-ae9096e6317a9877.js`）
3. 检查文件的响应头中的 `Last-Modified` 或 `ETag`
4. 对比服务器上对应文件的修改时间

在服务器上：
```bash
# 查看最新构建的 JavaScript 文件时间
ls -la /root/crown-main/.next/static/chunks/*.js | head -10

# 应该显示最近构建的时间（如 Jan 17 23:50）
```

**方法 4：对比服务器和浏览器的密钥**

在服务器上：
```bash
# 查看服务器 manifest 中的密钥
cat /root/crown-main/.next/server/server-reference-manifest.json | grep -o '"encryptionKey":"[^"]*"'
```

**方法 4.1：通过检查 Server Actions 请求来推断密钥**

在浏览器开发者工具中：
1. 打开 Network 标签
2. 触发一个会使用 Server Actions 的操作（如登录）
3. 查找 POST 请求到根路径 `/` 或包含 `?__rsc` 的请求
4. 查看请求的 Payload，Server Actions 请求会包含基于密钥加密的标识符

**方法 4.2：检查 JavaScript Bundle 文件内容（如果密钥被嵌入）**

在服务器上搜索 bundle 文件中的密钥：

```bash
# 在静态文件中搜索密钥（前10个字符）
grep -r "KvbqeW/sX/" /root/crown-main/.next/static/ 2>/dev/null | head -5

# 或者搜索完整的密钥
grep -r "KvbqeW/sX/7wfasNxOL5enuB1WJK/U0vcI172AJY5j4=" /root/crown-main/.next/static/ 2>/dev/null
```

如果找到了，说明密钥已嵌入到 bundle 中。

**如果密钥不一致，说明：**
- ✅ 浏览器使用的是旧的 bundle（缓存问题）
- ✅ 需要清除浏览器缓存并强制刷新

**如果密钥一致但仍然报错，说明：**
- ❌ 可能是其他问题（如 Next.js 15 的 bug、运行时环境变量等）

### 问题 9：考虑升级 Next.js 版本

**当前版本**：Next.js 15.2.4

**升级风险评估**：

#### 当前项目状态分析

1. **使用的 Next.js 特性**：
   - ✅ App Router（稳定特性）
   - ⚠️ Server Actions（experimental，但已启用）
   - ✅ API Routes（稳定特性）
   - ✅ 标准 Next.js 功能

2. **潜在兼容性问题**：
   - ⚠️ React 18.2.0 但 @types/react ^19（类型可能不匹配）
   - ⚠️ 多个依赖使用 "latest"（可能不稳定）
   - ⚠️ experimental.serverActions 可能在版本间变化

#### 升级建议

**方案 A：先尝试其他修复（推荐）**

在升级前，先尝试：
1. ✅ 添加运行时环境变量（方案 C）
2. ✅ 清除浏览器缓存
3. ✅ 检查是否有其他配置问题

**方案 B：小版本升级（15.2.4 → 15.3.x，如果存在）**

如果必须升级，建议：
```bash
# 检查最新版本
npm view next versions --json | tail -10

# 升级到最新的 15.x 版本（保持主版本一致）
pnpm add next@^15.3.0  # 或最新稳定版本

# 重新安装依赖
pnpm install

# 测试构建
pnpm build
```

**风险**：
- ✅ 小版本升级通常向后兼容
- ⚠️ experimental 特性可能变化
- ⚠️ 需要重新测试所有功能

**方案 C：保持当前版本，等待修复**

如果问题不是版本导致的：
- ✅ 保持 15.2.4（当前稳定版本）
- ✅ 等待 Next.js 官方修复
- ✅ 使用运行时环境变量作为临时方案

#### 升级后的测试清单

如果决定升级，需要测试：
1. ✅ 应用正常启动
2. ✅ 所有页面正常加载
3. ✅ 登录/认证功能正常
4. ✅ API Routes 正常工作
5. ✅ Server Actions 相关功能（如果有）
6. ✅ 构建和部署流程

#### 推荐做法

**建议顺序**：
1. **首先**：添加运行时环境变量（最安全，风险最低）
2. **如果不行**：清除浏览器缓存并测试
3. **最后考虑**：升级 Next.js 版本（需要充分测试）

**不推荐直接升级的原因**：
- ⚠️ 可能引入新的问题
- ⚠️ 需要全面测试
- ⚠️ 可能不是版本问题

### 问题 10：NextAuth 认证回调 403 错误

**症状**：`api/auth/callback/credentials` 返回 403 Forbidden

**原因**：NextAuth.js 在 Next.js 15 中也可能使用 Server Actions 机制，同样受 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 影响

**解决方案**：
1. **确认已应用 systemd 配置修复**（问题 1 的解决方案）
2. **检查服务器日志中的具体错误**：
```bash
# 查看最近的错误日志
sudo journalctl -u crown-main --since "10 minutes ago" | grep -i "error\|403\|forbidden"

# 查看完整的服务日志
sudo journalctl -u crown-main -n 100 --no-pager
```

3. **验证 NEXTAUTH_URL 配置正确**：
```bash
# 检查 .env 文件中的 NEXTAUTH_URL
grep NEXTAUTH_URL /root/crown-main/.env

# 应该匹配你的实际访问地址
# 例如：NEXTAUTH_URL=http://39.105.102.196:3000
```

4. **验证 NEXTAUTH_SECRET 配置**：
```bash
# 检查 NEXTAUTH_SECRET 是否存在
grep NEXTAUTH_SECRET /root/crown-main/.env
```

5. **测试环境变量是否在运行时被读取**：
```bash
# 方法1：直接检查 .env 文件内容（最简单，推荐）
grep -E "NEXTAUTH_SECRET|NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" /root/crown-main/.env

# 方法2：使用项目中的 dotenv（如果项目已安装）
cd /root/crown-main
node -e "require('dotenv').config(); console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ 已设置 (' + process.env.NEXTAUTH_SECRET.length + ' 字符)' : '❌ 未设置'); console.log('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:', process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ? '✅ 已设置 (' + process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY.length + ' 字符)' : '❌ 未设置');"

# 方法3：手动解析 .env 文件（不依赖任何模块，最可靠）
cat > /tmp/test-env-simple.js << 'EOF'
const fs = require('fs');
const path = '/root/crown-main/.env';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
const env = {};
lines.forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
});
console.log('NEXTAUTH_SECRET:', env.NEXTAUTH_SECRET ? '✅ 已设置 (' + env.NEXTAUTH_SECRET.length + ' 字符)' : '❌ 未设置');
console.log('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:', env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ? '✅ 已设置 (' + env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY.length + ' 字符)' : '❌ 未设置');
EOF
node /tmp/test-env-simple.js
```

6. **如果问题仍然存在，尝试完全重启**：
```bash
# 停止服务
sudo systemctl stop crown-main

# 等待几秒
sleep 5

# 检查是否还有残留进程
ps aux | grep -E "node|pnpm|next" | grep -v grep

# 如果有残留进程，手动终止
sudo pkill -f "next-server"
sudo pkill -f "pnpm"

# 重新启动
sudo systemctl start crown-main

# 查看日志
sudo journalctl -u crown-main -f
```

### 问题 7：验证构建产物

```bash
# 检查构建时间（确认是新构建的）
ls -la /root/crown-main/.next

# 检查构建产物中是否包含 Server Actions 相关文件
find /root/crown-main/.next -name "*server*" -type f | head -10
```

## 为什么本地运行没问题，但 systemd 部署有问题？

### 本地运行 vs systemd 部署的区别

#### 本地运行（`npm run dev` / `pnpm dev`）

**特点**：
- ✅ 使用开发模式（`next dev`）
- ✅ 环境变量自动从 `.env` 文件读取
- ✅ 每次重启都会重新加载环境变量
- ✅ 开发模式下 Server Actions 的行为更宽松
- ✅ 热重载机制会自动处理密钥变化

**为什么没问题**：
1. **开发模式**：Next.js 在开发模式下对 Server Actions 的处理更宽松
2. **自动重载**：每次代码变化都会重新加载，密钥保持一致
3. **环境变量**：开发模式会自动读取 `.env` 文件，无需显式配置

#### systemd 部署（`next start` 生产模式）

**特点**：
- ⚠️ 使用生产模式（`next start`）
- ⚠️ 环境变量需要显式配置
- ⚠️ 生产模式下 Server Actions 验证更严格
- ⚠️ 没有自动重载机制
- ⚠️ 需要同时配置构建时和运行时环境变量

**为什么有问题**：
1. **生产模式严格验证**：生产模式下 Server Actions 的密钥验证更严格
2. **环境变量配置**：systemd 需要显式配置环境变量，否则运行时读取不到
3. **构建 vs 运行时**：构建时和运行时都需要环境变量，但 systemd 的 `ExecStartPre` 可能不会自动继承

### 这是 systemd 的问题吗？

**部分是的**，但主要是配置问题：
- ✅ systemd 本身没问题
- ⚠️ 需要正确配置环境变量（构建时 + 运行时）
- ⚠️ 需要理解 Next.js 生产模式的行为

## 替代部署方案

如果 systemd 配置复杂，可以考虑以下替代方案：

### 方案 1：PM2（推荐，简单易用）

**优点**：
- ✅ 简单易用，配置简单
- ✅ 自动管理进程
- ✅ 自动重启
- ✅ 环境变量配置简单
- ✅ 支持日志管理

**安装和配置**：

```bash
# 1. 安装 PM2
npm install -g pm2

# 2. 创建 PM2 配置文件 ecosystem.config.js
cat > /root/crown-main/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crown-main',
    script: 'pnpm',
    args: 'start',
    cwd: '/root/crown-main',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_file: '/root/crown-main/.env',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/root/crown-main/logs/pm2-error.log',
    out_file: '/root/crown-main/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
  }]
}
EOF

# 3. 创建日志目录
mkdir -p /root/crown-main/logs

# 4. 启动应用
cd /root/crown-main
pm2 start ecosystem.config.js

# 5. 设置开机自启
pm2 startup
pm2 save

# 6. 查看状态
pm2 status
pm2 logs crown-main
```

**PM2 的优势**：
- ✅ `env_file` 选项自动加载 `.env` 文件
- ✅ 环境变量配置更简单
- ✅ 不需要区分构建时和运行时

### 方案 2：Docker（推荐，隔离性好）

**优点**：
- ✅ 环境隔离
- ✅ 配置简单
- ✅ 易于部署和扩展
- ✅ 环境变量通过 Docker 配置

**Dockerfile 示例**：

```dockerfile
FROM node:23-alpine

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "start"]
```

**docker-compose.yml 示例**：

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### 方案 3：Supervisor（类似 systemd，但更简单）

**优点**：
- ✅ 配置比 systemd 简单
- ✅ 环境变量配置更直观
- ✅ 自动重启

**配置示例**：

```ini
[program:crown-main]
command=/root/.nvm/versions/node/v23.11.0/bin/pnpm start
directory=/root/crown-main
user=root
autostart=true
autorestart=true
environment=NODE_ENV="production",PATH="/root/.nvm/versions/node/v23.11.0/bin:%(ENV_PATH)s"
stdout_logfile=/root/crown-main/logs/supervisor.log
stderr_logfile=/root/crown-main/logs/supervisor-error.log
```

### 方案 4：直接运行 + screen/tmux（最简单，但不推荐生产）

**优点**：
- ✅ 最简单
- ✅ 环境变量直接从 `.env` 读取

**缺点**：
- ❌ 没有自动重启
- ❌ 不适合生产环境

```bash
# 使用 screen
screen -S crown-main
cd /root/crown-main
source .env
pnpm start

# 或使用 tmux
tmux new -s crown-main
cd /root/crown-main
source .env
pnpm start
```

## 推荐方案对比

| 方案 | 难度 | 稳定性 | 推荐度 | 说明 |
|------|------|--------|--------|------|
| **PM2** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 最简单，推荐 |
| **Docker** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 隔离性好，适合生产 |
| **systemd** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 需要正确配置环境变量 |
| **Supervisor** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 类似 systemd，但更简单 |
| **screen/tmux** | ⭐ | ⭐⭐ | ⭐ | 仅适合测试 |

## 我的建议

**如果 systemd 配置复杂，推荐使用 PM2**：
1. ✅ 配置简单，`env_file` 自动加载 `.env`
2. ✅ 不需要区分构建时和运行时环境变量
3. ✅ 自动管理进程和重启
4. ✅ 日志管理方便

**如果已经配置好 systemd**：
- 继续使用 systemd，但确保：
  1. ✅ 构建时环境变量已配置（ExecStartPre）
  2. ✅ 运行时环境变量已配置（Environment）
  3. ✅ 验证环境变量是否正确加载

## 参考文档

- [Next.js Server Actions 官方文档](https://nextjs.org/docs/app/api-reference/functions/server-actions)
- [Next.js 错误消息：Failed to find Server Action](https://nextjs.org/docs/messages/failed-to-find-server-action)
- [PM2 官方文档](https://pm2.keymetrics.io/)
- [Docker 官方文档](https://docs.docker.com/)