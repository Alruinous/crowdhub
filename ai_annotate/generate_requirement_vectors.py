"""
使用 DeepSeek API 为每条数据生成任务需求向量
每个向量有 22 个维度，对应不同的科技领域，取值范围 0-1
"""

import pandas as pd
import json
import os
from openai import OpenAI
from typing import Dict, List
import time
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

# 23个科技领域
CATEGORIES = [
    "天文地理",
    "历史文明",
    "工业技术",
    "数学",
    "物理",
    "化学化工",
    "环境科学",
    "能源科技",
    "军事科技",
    "建筑水利",
    "交通运输",
    "农林牧渔",
    "航空航天航海",
    "健康管理",
    "临床知识",
    "安全科学",
    "信息技术",
    "生命科学",
    "材料科学",
    "科学家",
    "科学科幻",
    "交叉学科",
    "其他",
]


def init_deepseek_client(api_key: str = None) -> OpenAI:
    """初始化 DeepSeek 客户端"""
    if api_key is None:
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            raise ValueError("请设置 DEEPSEEK_API_KEY 环境变量或传入 api_key 参数")
    
    return OpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com"
    )


def generate_requirement_vectors_batch(client: OpenAI, rows_data: List[pd.Series]) -> List[Dict[str, float]]:
    """
    使用 DeepSeek API 批量为多条数据生成需求向量
    
    参数:
    - client: OpenAI 客户端
    - rows_data: 数据行列表
    
    返回:
    - requirement_vectors: 需求向量列表
    """
    batch_size = len(rows_data)
    
    # 构建批量数据描述
    resources_info = []
    for idx, row in enumerate(rows_data, 1):
           resources_info.append(f"""资源 {idx}：
           - 资源名称：{row.get('资源名称', 'N/A')}
           - 科技领域：{row.get('科技领域', 'N/A')}
           - 文件名：{row.get('文件名', 'N/A')}""")
    
    resources_text = "\n\n".join(resources_info)
    
    # 构建提示词
    prompt = f"""你是一个专业的科教资源分类评估专家。请仔细分析以下 {batch_size} 个科教资源，为每个资源评估完成其标注任务需要对各科技领域的知识掌握程度。

{resources_text}

【23个科技领域说明】
1. 天文地理 - 天文学、地球科学、地理学、地质学、水文学、海洋科学
2. 历史文明 - 历史学、考古学、哲学、宗教学、社会学、法学等人文社科
3. 工业技术 - 工业基础、纺织、动力电器、矿山、冶金、机械工程
4. 数学 - 数学
5. 物理 - 物理学、力学
6. 化学化工 - 化学、化学工程
7. 环境科学 - 环境科学技术、资源科学技术
8. 能源科技 - 能源科学技术、核科学技术
9. 军事科技 - 军事学、军事工程技术
10. 建筑水利 - 测绘、水利工程、土木建筑工程
11. 交通运输 - 交通运输工程
12. 农林牧渔 - 农学、水产学、林学、畜牧、兽医
13. 航空航天航海 - 航空航天科学技术
14. 健康管理 - 心理学、食品科学技术
15. 临床知识 - 基础医学、药学、中医学、临床医学、预防医学
16. 安全科学 - 安全科学技术
17. 信息技术 - 信息科学、电子通信、计算机科学
18. 生命科学 - 生物学、生命科学等
19. 材料科学 - 材料科学
20. 科学家 - 科学家人物、科学家故事
21. 科学科幻 - 科幻作品、科幻故事
22. 交叉学科 - 人工智能、量子信息、集成电路、脑科学与类脑研究、基因与生物技术、前沿临床医学与健康、深空深地深海和极地探测、交叉学科其他内容
23. 其他 - 无法归类的其他内容

【核心评分原则 - 请严格执行！】
第一步：仔细阅读每个资源的各个字段，尤其是"资源名称"、"科技领域"、"文件名"等
第二步：将这些字段中的内容与上述23个领域进行匹配
第三步：对匹配上的领域给高分（0.8-0.9），相关领域给中等分（0.5-0.7），不相关给低分（0.1-0.2）

评分规则：
- 强相关（资源的科技领域字段中明确提到）：0.8-0.9
- 相关（需要该领域背景知识）：0.5-0.7
- 弱相关（轻微关联）：0.3-0.4
- 不相关（完全无关）：0.1-0.2

【严格禁止】
❌ 所有资源给相同分数（例如全都是"科学家":0.9, "其他":0.8）
❌ 给"科学家"、"其他"等通用领域过高分数（除非资源确实是关于科学家人物的）

【输出格式】
返回JSON数组，每个元素是一个资源的评分对象：
[
    {{
        "天文地理": 0.8,
        "历史文明": 0.3,
        ...（全部23个领域）
    }},
    ...（共{batch_size}个对象）
]
【评分示例】
示例1：资源名称"中国天眼：极目光年之外"，科技领域"科学与艺术；科学教育理论"
分析："中国天眼"是大型射电望远镜，内容以天文学观测为核心，涉及物理原理与工程技术，人物不是主线。
评分：{{"天文地理":0.9, "历史文明":0.1, "工业技术":0.3, "数学":0.4, "物理":0.6, "化学化工":0.1, "环境科学":0.1, "能源科技":0.2, "军事科技":0.0, "建筑水利":0.3, "交通运输":0.1, "农林牧渔":0.0, "航空航天航海":0.4, "健康管理":0.0, "临床知识":0.0, "安全科学":0.2, "信息技术":0.4, "生命科学":0.0, "材料科学":0.3, "科学家":0.2, "科学科幻":0.0, "交叉学科":0.0, "其他":0.0}}

示例2：资源名称"人工智能：未来已来"，科技领域"科学与艺术；科学教育理论"
分析：内容为人工智能科普，重点介绍AI的概念与应用，属于信息技术领域，数学为重要支撑，非科幻作品。
评分：{{"天文地理":0.0, "历史文明":0.1, "工业技术":0.4, "数学":0.6, "物理":0.2, "化学化工":0.0, "环境科学":0.0, "能源科技":0.1, "军事科技":0.1, "建筑水利":0.0, "交通运输":0.1, "农林牧渔":0.0, "航空航天航海":0.1, "健康管理":0.1, "临床知识":0.0, "安全科学":0.3, "信息技术":0.9, "生命科学":0.1, "材料科学":0.2, "科学家":0.1, "科学科幻":0.3, "交叉学科":0.0, "其他":0.0}}

示例3：资源名称"天眼之父南仁东"，科技领域"科学与艺术；科学教育理论"
分析：内容以科学家南仁东的科研经历与精神为主线，天文领域作为背景出现，人物叙事优先于具体学科。
评分：{{"天文地理":0.6, "历史文明":0.3, "工业技术":0.3, "数学":0.2, "物理":0.4, "化学化工":0.0, "环境科学":0.0, "能源科技":0.1, "军事科技":0.0, "建筑水利":0.2, "交通运输":0.0, "农林牧渔":0.0, "航空航天航海":0.2, "健康管理":0.0, "临床知识":0.0, "安全科学":0.1, "信息技术":0.2, "生命科学":0.0, "材料科学":0.2, "科学家":0.9, "科学科幻":0.0, "交叉学科":0.0, "其他":0.0}}


只返回JSON数组，不要任何解释文字。"""

    # ====== 调试输出：打印实际提示词 ======
    # print(f"\n{'='*60}")
    # print(f"[调试] 发送给模型的提示词（前800字符）:")
    # print(f"{'='*60}")
    # print(prompt[:800])
    # print("...(省略)")
    # print(f"{'='*60}\n")

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个专业且严格的科教资源评估专家。你必须仔细阅读每个资源的'科技领域'字段，这是评分的核心依据。不同的资源必须给出完全不同的评分。绝对禁止所有资源都给相同的分数。绝对禁止忽视资源的科技领域信息而给'科学家'或'其他'高分。"},
                {"role": "user", "content": prompt} 
            ],
            temperature=0.8,  # 提高温度以增加差异性
            max_tokens=4000,  # 增加 token 限制
        )
        
        # 提取响应内容
        content = response.choices[0].message.content.strip()
        
        # ====== 调试输出：打印模型响应 ======
        # print(f"\n{'='*60}")
        # print(f"[调试] 模型返回的原始响应（前1000字符）:")
        # print(f"{'='*60}")
        # print(content[:1000])
        # if len(content) > 1000:
        #     print("...(省略)")
        # print(f"{'='*60}\n")
        
        # 去除可能的 markdown 代码块标记
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # 解析 JSON 数组
        vectors = json.loads(content)
        
        # ====== 调试输出：验证解析结果 ======
        # print(f"\n{'='*60}")
        # print(f"[调试] 解析后的向量数组:")
        # print(f"  - 数组长度: {len(vectors)}")
        # print(f"  - 期望长度: {batch_size}")
        # if len(vectors) > 0:
        #     print(f"  - 第1个向量示例: {json.dumps(vectors[0], ensure_ascii=False)[:200]}...")
        #     if len(vectors) > 1:
        #         print(f"  - 第2个向量示例: {json.dumps(vectors[1], ensure_ascii=False)[:200]}...")
        # print(f"{'='*60}\n")
        
        # 验证数组长度
        if len(vectors) != batch_size:
            print(f"警告：返回的向量数量 ({len(vectors)}) 与请求数量 ({batch_size}) 不匹配")
            # 补齐或截断
            while len(vectors) < batch_size:
                vectors.append({category: 0.5 for category in CATEGORIES})
            vectors = vectors[:batch_size]
        
        # 验证和修正每个向量
        for i, vector in enumerate(vectors):
            for category in CATEGORIES:
                if category not in vector:
                    print(f"警告：资源 {i+1} 的领域 '{category}' 缺失，设置为默认值 0.4")
                    vector[category] = 0.4
                else:
                    # 确保值在 0-1 范围内
                    vector[category] = max(0.0, min(1.0, float(vector[category])))
        
        return vectors
        
    except json.JSONDecodeError as e:
        print(f"JSON 解析失败: {e}")
        print(f"原始响应: {content[:500]}...")  # 只打印前500字符
        # 返回默认向量
        return [{category: 0.5 for category in CATEGORIES} for _ in range(batch_size)]
    except Exception as e:
        print(f"API 调用失败: {e}")
        # 返回默认向量
        return [{category: 0.5 for category in CATEGORIES} for _ in range(batch_size)]


def process_excel_file(
    input_file: str,
    output_file: str,
    api_key: str = None,
    start_row: int = 0,
    max_rows: int = None,
    batch_size: int = 20,
    delay: float = 0.5
):
    """
    处理 Excel 文件，为每条数据生成需求向量（支持批量处理）
    
    参数:
    - input_file: 输入的 Excel 文件路径
    - output_file: 输出的 Excel 文件路径
    - api_key: DeepSeek API Key（可选，默认从环境变量读取）
    - start_row: 起始行号（用于断点续传）
    - max_rows: 最多处理多少行（用于测试）
    - batch_size: 每次批量处理的数据条数（默认 5）
    - delay: 每次 API 调用之间的延迟（秒）
    """
    print(f"开始处理文件: {input_file}")
    print(f"批量大小: {batch_size} 条/次")
    
    # 初始化客户端
    client = init_deepseek_client(api_key)
    
    # 读取 Excel 文件
    df = pd.read_excel(input_file)
    print(f"读取到 {len(df)} 条数据")
    
    # 如果输出文件已存在，读取已有结果
    if os.path.exists(output_file):
        print(f"发现已有输出文件，加载进度...")
        existing_df = pd.read_excel(output_file)
        # 找到第一个未处理的行
        if 'requirementVector' in existing_df.columns:
            start_row = existing_df['requirementVector'].notna().sum()
        print(f"从第 {start_row + 1} 行继续处理")
    
    # 确定处理范围
    end_row = len(df) if max_rows is None else min(start_row + max_rows, len(df))
    
    # 添加需求向量列（如果不存在）
    if 'requirementVector' not in df.columns:
        df['requirementVector'] = pd.Series(dtype='object')  # 明确指定为object类型，支持存储JSON字符串
    
    # 批量处理
    total_batches = (end_row - start_row + batch_size - 1) // batch_size
    processed_count = 0
    
    for batch_idx in range(start_row, end_row, batch_size):
        batch_end = min(batch_idx + batch_size, end_row)
        current_batch_size = batch_end - batch_idx
        current_batch_num = (batch_idx - start_row) // batch_size + 1
        
        print(f"\n{'='*60}")
        print(f"批次 {current_batch_num}/{total_batches}: 处理第 {batch_idx + 1}-{batch_end} 条数据...")
        print(f"{'='*60}")
        
        # 获取当前批次的数据
        batch_rows = [df.iloc[i] for i in range(batch_idx, batch_end)]
        
        try:
            # 批量生成需求向量
            vectors = generate_requirement_vectors_batch(client, batch_rows)
            
            # 保存结果
            for i, vector in enumerate(vectors):
                row_idx = batch_idx + i
                
                # ====== 调试输出：验证向量分配 ======
                if i < 2:  # 只打印前2个
                    row = df.iloc[row_idx]
                
                df.at[row_idx, 'requirementVector'] = json.dumps(vector, ensure_ascii=False)
                
            processed_count += current_batch_size
            
            # 每个批次后保存一次
            df.to_excel(output_file, index=False)
            print(f"\n  💾 已保存进度 ({processed_count}/{end_row - start_row} 条完成)")
            
            # 延迟，避免超过 API 限制
            if batch_end < end_row:
                print(f"  ⏳ 等待 {delay} 秒...")
                time.sleep(delay)
            
        except Exception as e:
            print(f"  ✗ 批次处理失败: {e}")
            # 使用默认向量
            for i in range(current_batch_size):
                row_idx = batch_idx + i
                df.at[row_idx, 'requirementVector'] = json.dumps(
                    {cat: 0.5 for cat in CATEGORIES}, ensure_ascii=False
                )
    
    # 最终保存
    df.to_excel(output_file, index=False)
    
    # 统计信息
    total_api_calls = total_batches
    time_saved = (end_row - start_row) - total_api_calls
    print(f"\n{'='*60}")
    print(f"✅ 全部完成！")
    print(f"   - 处理数据: {end_row - start_row} 条")
    print(f"   - API 调用: {total_api_calls} 次")
    print(f"   - 结果文件: {output_file}")
    print(f"{'='*60}")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='为科教资源数据生成任务需求向量')
    parser.add_argument('input_file', help='输入的 Excel 文件路径')
    parser.add_argument('-o', '--output', help='输出的 Excel 文件路径（默认为 input_with_vectors.xlsx）')
    parser.add_argument('-k', '--api-key', help='DeepSeek API Key（默认从环境变量 DEEPSEEK_API_KEY 读取）')
    parser.add_argument('-s', '--start', type=int, default=0, help='起始行号（用于断点续传）')
    parser.add_argument('-m', '--max-rows', type=int, help='最多处理多少行（用于测试）')
    parser.add_argument('-b', '--batch-size', type=int, default=10, help='每次批量处理的数据条数（默认 10）')
    parser.add_argument('-d', '--delay', type=float, default=0.5, help='每次 API 调用之间的延迟（秒）')
    
    args = parser.parse_args()
    
    # 确定输出文件名
    if args.output is None:
        base_name = os.path.splitext(args.input_file)[0]
        output_file = f"{base_name}_with_vectors.xlsx"
    else:
        output_file = args.output
    
    # 处理文件
    process_excel_file(
        input_file=args.input_file,
        output_file=output_file,
        api_key=args.api_key,
        start_row=args.start,
        max_rows=args.max_rows,
        batch_size=args.batch_size,
        delay=args.delay
    )


if __name__ == "__main__":
    main()
