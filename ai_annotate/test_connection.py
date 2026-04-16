"""
测试 DeepSeek API 连接
"""

import os
from openai import OpenAI
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

def test_deepseek_connection(api_key: str = None):
    """
    测试 DeepSeek API 连接
    
    参数:
    - api_key: DeepSeek API Key（可选，默认从环境变量读取）
    """
    print("=" * 60)
    print("🔍 开始测试 DeepSeek API 连接...")
    print("=" * 60)
    
    # 获取 API Key
    if api_key is None:
        api_key = os.getenv("DEEPSEEK_API_KEY")
        if not api_key:
            print("❌ 错误: 未找到 DEEPSEEK_API_KEY 环境变量")
            print("\n请按以下步骤设置:")
            print("1. 创建 .env 文件（如果不存在）")
            print("2. 添加一行: DEEPSEEK_API_KEY=your_api_key_here")
            print("3. 或者使用命令: python test_connection.py -k your_api_key_here")
            return False
    
    print(f"✓ API Key: {api_key[:10]}...{api_key[-4:]}")
    
    # 初始化客户端
    try:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
        print("✓ 客户端初始化成功")
    except Exception as e:
        print(f"❌ 客户端初始化失败: {e}")
        return False
    
    # 发送测试请求
    print("\n📡 发送测试请求...")
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个测试助手。"},
                {"role": "user", "content": "请用一句话回复：连接成功"}
            ],
            max_tokens=50,
            temperature=0.3
        )
        
        # 获取响应
        reply = response.choices[0].message.content
        print(f"✓ 收到响应: {reply}")
        
        # 显示使用信息
        if hasattr(response, 'usage'):
            usage = response.usage
            print(f"\n📊 使用统计:")
            print(f"   - 输入 tokens: {usage.prompt_tokens}")
            print(f"   - 输出 tokens: {usage.completion_tokens}")
            print(f"   - 总计 tokens: {usage.total_tokens}")
        
        print("\n" + "=" * 60)
        print("✅ DeepSeek API 连接测试成功！")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ API 调用失败: {e}")
        print("\n可能的原因:")
        print("1. API Key 无效或已过期")
        print("2. 网络连接问题")
        print("3. API 服务暂时不可用")
        print("4. 账户余额不足")
        print("\n请检查:")
        print("- 访问 https://platform.deepseek.com/ 确认 API Key")
        print("- 检查网络连接")
        print("- 查看账户余额")
        return False


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='测试 DeepSeek API 连接')
    parser.add_argument('-k', '--api-key', help='DeepSeek API Key（默认从环境变量 DEEPSEEK_API_KEY 读取）')
    
    args = parser.parse_args()
    
    # 测试连接
    success = test_deepseek_connection(args.api_key)
    
    if success:
        print("\n💡 提示: 现在可以运行主程序了")
        print("   python generate_requirement_vectors.py 数据.xlsx -m 10")
    else:
        exit(1)


if __name__ == "__main__":
    main()
