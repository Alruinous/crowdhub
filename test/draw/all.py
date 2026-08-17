import matplotlib.pyplot as plt

# 时间
days = ["27-28", "29-30", "31-01", "02-03", "04-05", "06-07", "08-09"]

# 准确率数据
accuracy = [68.95, 69.77, 68.40, 71.82, 74.43, 72.23, 75.33]

# 创建图表
plt.figure(figsize=(10, 5))

# 绘制折线图
plt.plot(days, accuracy, marker='o')

# 添加数据标签（进一步上移）
for x, y in zip(days, accuracy):
    plt.text(x, y + 0.8, f"{y:.2f}%", ha='center')

# 标题与坐标轴
plt.title("Annotation Accuracy Trend")
plt.xlabel("Time")
plt.ylabel("Accuracy (%)")

# 设置纵轴范围
plt.ylim(65, 80)

# 网格
plt.grid(True)

# 显示图像
plt.show()