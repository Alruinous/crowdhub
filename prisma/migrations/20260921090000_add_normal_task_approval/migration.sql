-- AlterTable
ALTER TABLE "normal_tasks" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;

-- 已经发布或完成的历史日常任务保持可见；未发布草稿仍为未审批。
UPDATE "normal_tasks"
SET "approved" = true
WHERE "status" IN ('IN_PROGRESS', 'COMPLETED');
