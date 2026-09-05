// 全局系统设置（复用 AiConfig 通用 key-value 表，避免新增数据表）

import { db } from "@/lib/db";

/** 发布者创建的标注任务是否需要管理员审核后才能进入任务广场被 worker 认领 */
export const KEY_ANNOTATION_REQUIRES_APPROVAL = "annotationRequiresApproval";

/** 读取该开关；默认 true（需要审核） */
export async function getAnnotationApprovalRequired(): Promise<boolean> {
  const row = await db.aiConfig.findUnique({
    where: { key: KEY_ANNOTATION_REQUIRES_APPROVAL },
  });
  // 未配置时按“需要审核”处理
  return row ? row.value !== "false" : true;
}
