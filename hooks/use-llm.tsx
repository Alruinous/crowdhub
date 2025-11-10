import { toast } from "./use-toast";

// 修改返回类型，包含思考过程
interface AIResponse<T> {
  data: T;
  thinking?: string;
}

// AI配置类型
interface AIConfig {
  baseURL: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  apiKey?: string; // 添加apiKey字段
}

// 从API获取配置
async function getAIConfig(): Promise<AIConfig> {
  try {
    const response = await fetch("/api/ai-configs");
    if (!response.ok) {
      throw new Error("Failed to fetch AI configs");
    }
    const configs = await response.json();

    // 将配置从对象数组转换为单个配置对象
    const configObj: AIConfig = {
      baseURL: configs.find((c: any) => c.key === "baseURL")?.value || "",
      model:
        configs.find((c: any) => c.key === "model")?.value ||
        "/models/DeepSeek-R1-Distill-Qwen-32B",
      temperature: parseFloat(
        configs.find((c: any) => c.key === "temperature")?.value || "0.7"
      ),
      systemPrompt:
        configs.find((c: any) => c.key === "systemPrompt")?.value ||
        "你是一个任务分解助手，能够根据任务描述和接单者数量将任务合理地分解为子任务。返回的内容必须是合法的JSON格式。",
      apiKey: configs.find((c: any) => c.key === "apiKey")?.value || "", // 获取apiKey
    };

    return configObj;
  } catch (error) {
    console.error("获取AI配置失败:", error);
    // 返回默认配置
    return {
      baseURL: "",
      model: "/models/DeepSeek-R1-Distill-Qwen-32B",
      temperature: 0.7,
      systemPrompt:
        "你是一个任务分解助手，能够根据任务描述和接单者数量将任务合理地分解为子任务。返回的内容必须是合法的JSON格式。",
      apiKey: "", // 默认空apiKey
    };
  }
}

// 添加新函数: 使用大模型拆分子任务
async function splitTasksWithAI<T>(
  formData: T,
  assigneeCount: number,
  apiKey?: string
): Promise<AIResponse<T>> {
  try {
    // 获取AI配置
    const config = await getAIConfig();

    const prompt = `你是一个任务分解专家，请根据以下要求将主任务拆分为子任务：
# 输入信息
1. 接单者数量：${assigneeCount}（即需要拆分的子任务数量）
2. 主任务信息：${JSON.stringify(formData, null, 2)}

# 处理要求
1. 子任务拆分：
   - 子任务数量必须等于接单者数量
   - 所有子任务的分数总和必须等于主任务分数
   - 每个子任务分数必须是正整数
   - 子任务分数可以不同

2. 描述优化：
   - 重写主任务的任务描述(description字段)，使其更加清晰明确
   - 每个子任务需要有清晰的标题(title)和描述(description)

3. 输出格式：
   - 保持原始JSON结构不变
   - 必须包含完整的subtasks数组
   - 返回的数据必须直接符合"FormSchemaType"类型定义
    type FormSchemaType = {
        title: string;
        description: string;
        categoryId: string;
        typeId: string;
        points: number;
        maxWorkers: number;
        subtasks: {
            title: string;
            description: string;
            points: number;
        }[];
    }

# 输出格式示例
{
    "title": "...",
    "description": "优化后的任务描述...",
    "categoryId": "...",
    "typeId": "...",
    "points": ...,
    "maxWorkers": ...,
    "subtasks": [
        {
            "title": "子任务1标题",
            "description": "子任务1详细描述",
            "points": ...
        },
        ...
    ]
}

请返回符合上述要求的完整JSON对象，不要包含任何解释性文字。`;

    // 使用代理API而不是直接请求大模型服务
    const response = await fetch(`/api/ai-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: config.systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: config.temperature,
        apiKey: apiKey || config.apiKey, // 使用传入的apiKey或配置中的apiKey
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI代理API错误详情:', {
        status: response.status,
        statusText: response.statusText,
        url: '/api/ai-proxy',
        errorText: errorText
      });
      throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("API返回数据格式不正确");
    }

    // 解析AI返回的结果并提取思考过程
    const content = data.choices[0].message.content;

    // 提取思考过程
    let thinking = "";
    let jsonString = content;

    if (content.includes("</think>")) {
      const parts = content.split("</think>");
      thinking = parts[0].replace("<think>", "").trim();
      jsonString = parts[1];
    }

    // 提取JSON
    let jsonContent = "";
    if (jsonString.includes("```json")) {
      const jsonStart = jsonString.indexOf("```json") + 7;
      const jsonEnd = jsonString.indexOf("```", jsonStart);
      jsonContent = jsonString.substring(jsonStart, jsonEnd).trim();
    } else if (jsonString.includes("```")) {
      const jsonStart = jsonString.indexOf("```") + 3;
      const jsonEnd = jsonString.indexOf("```", jsonStart);
      jsonContent = jsonString.substring(jsonStart, jsonEnd).trim();
    } else {
      // 尝试直接解析整个内容
      jsonContent = jsonString.trim();
    }

    const aiResponse = JSON.parse(jsonContent);

    // 合并结果，保留原表单中非subtask的部分
    const result = {
      ...formData,
      subtasks: aiResponse.subtasks || [],
    };

    return {
      data: result as T,
      thinking: thinking,
    };
  } catch (error) {
    console.error("使用AI切分子任务失败:", error);
    // 失败时返回原始数据和错误信息
    return {
      data: formData,
      thinking: `处理失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export { splitTasksWithAI };
