// AI 日常任务子任务分解服务：读取 AiConfig，调用 DeepSeek（OpenAI 兼容 /chat/completions）
// 将任务描述拆分为 1~5 个可独立完成的子任务。
import { db } from "@/lib/db";

export interface AiSubtask {
  title: string;
  description: string;
  /** 子任务价值分数（所有子任务之和 = 任务总积分） */
  points: number;
}

const SYSTEM_PROMPT =
  "你是一个任务分解助手，能够根据任务描述将任务合理地分解为 1 到 5 个可独立完成的子任务。返回的内容必须是合法的 JSON 数组，不要包含任何解释性文字。";

function buildPrompt(task: { title: string; description: string; points: number }): string {
  return `请将下面的日常任务分解为若干个子任务：
# 任务信息
- 任务标题：${task.title}
- 任务描述：${task.description}
- 任务总积分：${task.points}

# 分解要求
1. 子任务数量控制在 1 到 5 个，不要太多，但要能完整覆盖任务内容。
2. 每个子任务需要有清晰的标题(title)、描述(description)和价值分数(points)。
3. 子任务之间尽量互不依赖，可以并行完成。
4. 根据每个子任务的难度和工作量，为它分配合理的价值分数(points)，且**所有子任务的分数之和必须严格等于任务总积分 ${task.points}**。

# 输出格式
请只返回一个 JSON 数组，格式如下，不要包含任何其他文字：
[
  { "title": "子任务1标题", "description": "子任务1详细描述", "points": 30 },
  { "title": "子任务2标题", "description": "子任务2详细描述", "points": 40 }
]`;
}

function extractJson(content: string): unknown {
  let jsonString = content;
  // 剥离 <think> 思考过程（DeepSeek R1 系列会输出）
  if (content.includes("</think>")) {
    const parts = content.split("</think>");
    jsonString = parts[1] || content;
  }
  // 提取 ```json ... ``` 或 ``` ... ``` 代码块
  let jsonContent = jsonString.trim();
  const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonContent = fenceMatch[1].trim();
  }
  return JSON.parse(jsonContent);
}

export async function splitNormalTaskWithAI(task: {
  title: string;
  description: string;
  points: number;
}): Promise<AiSubtask[]> {
  const configs = await db.aiConfig.findMany();
  const baseURL = configs.find((c) => c.key === "baseURL")?.value || "";
  const model = configs.find((c) => c.key === "model")?.value || "deepseek-chat";
  const apiKey = configs.find((c) => c.key === "apiKey")?.value || "";
  const temperature = parseFloat(
    configs.find((c) => c.key === "temperature")?.value || "0.5"
  );

  if (!baseURL) {
    throw new Error("未配置 AI 服务地址（baseURL）");
  }

  const chatEndpoint = baseURL.endsWith("/chat/completions")
    ? baseURL
    : `${baseURL.replace(/\/+$/, "")}/chat/completions`;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(chatEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(task) },
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`AI 任务分解失败（HTTP ${response.status}）：${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 返回格式不正确：缺少 content");
  }

  const parsed = extractJson(content);
  if (!Array.isArray(parsed)) {
    throw new Error("AI 返回的不是子任务数组");
  }

  const subtasks: AiSubtask[] = parsed
    .map((item: any) => ({
      title: String(item?.title ?? "").trim(),
      description: String(item?.description ?? "").trim(),
      points: Math.round(Number(item?.points)),
    }))
    .filter(
      (s) =>
        s.title &&
        s.description &&
        Number.isInteger(s.points) &&
        s.points >= 1
    );

  if (subtasks.length === 0) {
    throw new Error("AI 未生成任何有效子任务");
  }

  // 校验所有子任务分数之和等于任务总积分
  const sum = subtasks.reduce((acc, s) => acc + s.points, 0);
  if (sum !== task.points) {
    throw new Error(
      `AI 拆分后的子任务分数之和（${sum}）与任务总积分（${task.points}）不一致，请重试`
    );
  }

  // 限制最多 5 个，避免拆分过多
  return subtasks.slice(0, 5);
}
