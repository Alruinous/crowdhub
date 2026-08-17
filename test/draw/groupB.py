import matplotlib.pyplot as plt

# 时间
days = ["03-04", "05-06", "07-08", "09-10", "11-12", "13-14", "15-16"]

# 准确率数据
accuracy = [68.18, 72.03, 71.54, 70.67, 69.82, 71.12, 71.48]

# 创建图表
plt.figure(figsize=(10, 5))

# 绘制折线图
plt.plot(days, accuracy, marker='o')

# 添加数据标签
for x, y in zip(days, accuracy):
    plt.text(x, y + 0.3, f"{y:.2f}%", ha='center')

# 标题与坐标轴
plt.title("Random Assignment Accuracy Trend")
plt.xlabel("Time")
plt.ylabel("Accuracy (%)")

# 设置纵轴范围
plt.ylim(65, 76)

# 网格
plt.grid(True)

# 显示图像
plt.show()