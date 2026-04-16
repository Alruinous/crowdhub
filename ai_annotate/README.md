# AI 标注任务需求向量生成工具

使用 DeepSeek API 自动为科教资源数据生成任务需求向量。

## 功能

- 读取 Excel 文件中的科教资源数据
- 调用 DeepSeek API 分析每条数据的领域需求
- 生成 22 维需求向量（每个维度对应一个科技领域，取值 0-1）
- 支持断点续传
- 自动保存进度

## 安装依赖

```bash
pip install pandas openpyxl openai python-dotenv
```

## 配置 API Key

### 方法 1：环境变量（推荐）

在项目根目录的 `.env` 文件中添加：

```env
DEEPSEEK_API_KEY=your_api_key_here
```

### 方法 2：命令行参数

```bash
python generate_requirement_vectors.py input.xlsx -k your_api_key_here
```

## 使用方法

### 基本用法

```bash
python generate_requirement_vectors.py 原【科创筑梦】科教资源清单20250929.xlsx
```

输出文件默认为：`原【科创筑梦】科教资源清单20250929_with_vectors.xlsx`

### 指定输出文件

```bash
python generate_requirement_vectors.py input.xlsx -o output.xlsx
```

### 测试模式（只处理前 10 条）

```bash
python generate_requirement_vectors.py input.xlsx -m 10
```

### 断点续传

如果处理过程中断，重新运行相同命令即可继续：

```bash
python generate_requirement_vectors.py input.xlsx -o output.xlsx
```

程序会自动检测已处理的行数并继续。

### 中途停止

**方法**：按 `Ctrl + C` 停止程序

**效果**：
- 已完成的批次数据已自动保存
- 重新运行相同命令可继续处理
- 当前批次（最后10条）可能需要重新处理

**恢复处理**：
```bash
# 直接重新运行相同命令
python generate_requirement_vectors.py input.xlsx -o output.xlsx
# 程序会显示：从第 XX 行继续处理
```

### 调整 API 调用频率

```bash
# 每次调用间隔 1 秒（避免超过速率限制）
python generate_requirement_vectors.py input.xlsx -d 1.0
```

## 参数说明

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `input_file` | - | 输入的 Excel 文件路径（必需） | - |
| `--output` | `-o` | 输出文件路径 | `{input}_with_vectors.xlsx` |
| `--api-key` | `-k` | DeepSeek API Key | 从环境变量读取 |
| `--start` | `-s` | 起始行号（断点续传） | 0 |
| `--max-rows` | `-m` | 最多处理多少行（测试用） | 全部 |
| `--batch-size` | `-b` | 每次批量处理的数据条数 | 10 |
| `--delay` | `-d` | 每次 API 调用间隔（秒） | 0.5 |

## 输出格式

生成的 Excel 文件会在原有列基础上添加：
**requirementVector**：需求向量的 JSON 字符串
```json
{
  "天文地理": 0.7,
  "历史文明": 0.3,
  "工业技术": 0.4,
  ...
}
```
2. **vector_length**：向量长度（固定为 22）

## 向量评分标准

- **0.0-0.3**：几乎不需要该领域知识
- **0.3-0.5**：需要基础的该领域知识
- **0.5-0.7**：需要较强的该领域知识
- **0.7-1.0**：需要专业级的该领域知识

## 22 个科技领域

1. 天文地理
2. 历史文明
3. 工业技术
4. 数学
5. 物理
6. 化学
7. 环境科学
8. 能源科技
9. 军事科技
10. 建筑水利
11. 交通运输
12. 农林牧渔
13. 航空航天航海
14. 健康管理
15. 临床知识
16. 安全科学
17. 信息技术
18. 生物学
19. 材料科学
20. 科学家
21. 科学科幻
22. 其他

## 注意事项

1. **API 限制**：DeepSeek API 有调用频率限制，建议设置适当的延迟
2. **成本**：处理 7000 条数据约需调用 7000 次 API
3. **进度保存**：程序每处理 10 条数据自动保存一次进度
4. **批量处理**：默认每次处理 10 条数据，可通过 `-b` 参数调整
3. **中途停止**：按 `Ctrl+C` 可安全停止，已处理数据已保存，重新运行可继续
4. **进度保存**：程序每完成一个批次自动保存进度
5. **错误处理**：如果某批

``测试连接
python test_connection.py

# 先测试 10 条看效果
python generate_requirement_vectors.py 原【科创筑梦】科教资源清单20250929.xlsx \
  -o test_output.xlsx \
  -m 10

# 完整处理：7000 条数据，每批 10 条
python generate_requirement_vectors.py 原【科创筑梦】科教资源清单20250929.xlsx \
  -o 科教资源_with_vectors.xlsx \
  -b 10

# 如果中途停止（Ctrl+C），重新运行相同命令继续
python generate_requirement_vectors.py 原【科创筑梦】科教资源清单20250929.xlsx \
  -o 科教资源_with_vectors.xlsx \
  -b 10
```

## 性能参考

**7000 条数据处理时间**：
- 批量大小 5：约 15 分钟（1400 次 API 调用）
- 批量大小 10：约 8 分钟（700 次 API 调用）⭐ 推荐
- 批量大小 15：约 6 分钟（467 次 API 调用）m 10
```
