-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_annotation_task_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "scoredById" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "annotation_task_scores_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotation_task_scores_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotation_task_scores" ("createdAt", "id", "score", "scoredById", "taskId", "workerId") SELECT "createdAt", "id", "score", "scoredById", "taskId", "workerId" FROM "annotation_task_scores";
DROP TABLE "annotation_task_scores";
ALTER TABLE "new_annotation_task_scores" RENAME TO "annotation_task_scores";
CREATE INDEX "annotation_task_scores_taskId_idx" ON "annotation_task_scores"("taskId");
CREATE UNIQUE INDEX "annotation_task_scores_taskId_workerId_key" ON "annotation_task_scores"("taskId", "workerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
