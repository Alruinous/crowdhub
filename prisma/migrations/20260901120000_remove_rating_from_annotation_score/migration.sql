-- Drop rating column (原始 1-10 打分不再展示)
ALTER TABLE "annotation_task_scores" DROP COLUMN "rating";
