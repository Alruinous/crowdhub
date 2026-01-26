import pandas as pd
import os

def split_knowledge_points(input_file, output_file):
    """
    读取Excel文件，将最后一列按'、'号拆分成多行，保持层级关系
    
    参数:
        input_file: 输入的Excel文件路径
        output_file: 输出的Excel文件路径
    """
    # 读取Excel文件
    df = pd.read_excel(input_file)
    
    # 先进行前向填充，确保每行都有完整的分类路径
    df = df.fillna(method='ffill')
    
    # 获取列名
    columns = df.columns.tolist()
    
    # 创建新的数据列表
    new_rows = []
    
    # 遍历每一行
    for idx, row in df.iterrows():
        # 获取最后一列的内容
        knowledge_points = str(row[columns[-1]])
        
        # 如果内容为空或NaN，保留原行
        if pd.isna(row[columns[-1]]) or knowledge_points.strip() == '' or knowledge_points == 'nan':
            new_rows.append(row.tolist())
            continue
        
        # 按'、'号拆分知识点
        points = [p.strip() for p in knowledge_points.split('、') if p.strip()]
        
        # 如果拆分后只有一个项目，保留原行
        if len(points) <= 1:
            new_rows.append(row.tolist())
            continue
        
        # 为每个拆分后的知识点创建新行
        for point in points:
            new_row = []
            # 复制前面所有列的值
            for col_idx in range(len(columns) - 1):
                new_row.append(row[columns[col_idx]])
            # 添加拆分后的单个知识点
            new_row.append(point)
            new_rows.append(new_row)
    
    # 创建新的DataFrame
    new_df = pd.DataFrame(new_rows, columns=columns)
    
    # 保存到新的Excel文件
    new_df.to_excel(output_file, index=False, engine='openpyxl')
    print(f"处理完成！共生成 {len(new_rows)} 行数据")
    print(f"结果已保存至: {output_file}")

# 使用示例
if __name__ == "__main__":
    # 设置输入和输出文件路径
    input_file = "label_before.xlsx"  # 请修改为你的输入文件名
    output_file = "output.xlsx"  # 输出文件名
    
    # 检查文件是否存在
    if not os.path.exists(input_file):
        print(f"错误：找不到文件 {input_file}")
        print("请将此脚本放在Excel文件所在目录，或修改input_file变量为正确的文件路径")
    else:
        try:
            split_knowledge_points(input_file, output_file)
        except Exception as e:
            print(f"处理过程中出现错误: {e}")
            import traceback
            traceback.print_exc()