import matplotlib.pyplot as plt

# 时间
days = ["03-04", "05-06", "07-08", "09-10", "11-12", "13-14", "15-16"]

# 准确率数据
accuracy = [77.42, 79.15, 78.03, 76.76, 79.24, 80.36, 79.41]

# 创建图表
plt.figure(figsize=(10, 5))

# 绘制折线图
plt.plot(days, accuracy, marker='o')

# 添加数据标签
for x, y in zip(days, accuracy):
    plt.text(x, y + 0.3, f"{y:.2f}%", ha='center')

# 标题与坐标轴
plt.title("Assisted Annotation Accuracy Trend")
plt.xlabel("Time")
plt.ylabel("Accuracy (%)")

# 设置纵轴范围
plt.ylim(75, 85)

# 网格
plt.grid(True)

# 显示图像
plt.show()