#!/usr/bin/env python3
"""
输入两个 Excel 文件 A 和 B，按「前两列」对齐：
- 仅保留 B 中「前两列与 A 中某行相同」的行；
- B 中前两列在 A 里不存在的行视为删除，不写入结果。
最终输出修改后的 B（只含保留行）到新文件。

用法:
  python scripts/filter_excel_by_ab.py <文件A> <文件B> [输出文件]

示例（在项目根目录执行）:
  # 用 A=demodata_23.xlsx 过滤 B=label_23.xlsx，结果写到 output.xlsx
  python scripts/filter_excel_by_ab.py demodata_23.xlsx label_23.xlsx output.xlsx

  # 不写第三个参数时，结果默认保存为 filter_excel_b_result.xlsx
  python scripts/filter_excel_by_ab.py a.xlsx b.xlsx

依赖: pip install pandas openpyxl
"""

import sys
import pandas as pd


def main():
    if len(sys.argv) < 3:
        print("用法: python scripts/filter_excel_by_ab.py <文件A> <文件B> [输出文件]")
        print("示例: python scripts/filter_excel_by_ab.py demodata_23.xlsx label_23.xlsx output.xlsx")
        sys.exit(1)

    path_a = sys.argv[1]
    path_b = sys.argv[2]
    path_out = sys.argv[3] if len(sys.argv) > 3 else "filter_excel_b_result.xlsx"

    # 读取，第一行作为表头
    df_a = pd.read_excel(path_a, header=0)
    df_b = pd.read_excel(path_b, header=0)

    col0 = df_a.columns[0]
    col1 = df_a.columns[1]
    if col0 not in df_b.columns or col1 not in df_b.columns:
        print("错误：两个文件都至少需要两列，且前两列列名需一致")
        sys.exit(1)

    # A 的前两列集合（用于判定 B 的某行是否在 A 中存在），O(1) 查找
    set_a = set(zip(df_a[col0].astype(str), df_a[col1].astype(str)))

    # 向量化：一次构造 B 的前两列元组序列，再用 isin(set_a)，避免逐行 apply
    keys_b = pd.Series(zip(df_b[col0].astype(str), df_b[col1].astype(str)))
    mask = keys_b.isin(set_a)
    df_b_filtered = df_b[mask].copy()

    df_b_filtered.to_excel(path_out, index=False)
    print(f"已保留 {df_b_filtered.shape[0]} 行（原 B 共 {len(df_b)} 行），结果写入: {path_out}")


if __name__ == "__main__":
    main()
