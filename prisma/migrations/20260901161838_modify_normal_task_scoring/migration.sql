/*
  Warnings:

  - Added the required column `points` to the `normal_subtasks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtaskId` to the `normal_task_scores` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_normal_subtasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT,
    CONSTRAINT "normal_subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "normal_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "normal_subtasks_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_normal_subtasks" ("completedAt", "createdAt", "description", "id", "status", "taskId", "title", "updatedAt", "workerId") SELECT "completedAt", "createdAt", "description", "id", "status", "taskId", "title", "updatedAt", "workerId" FROM "normal_subtasks";
DROP TABLE "normal_subtasks";
ALTER TABLE "new_normal_subtasks" RENAME TO "normal_subtasks";
CREATE TABLE "new_normal_task_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "scoredById" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "normal_task_scores_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "normal_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "normal_task_scores_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "normal_subtasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "normal_task_scores_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_normal_task_scores" ("createdAt", "id", "score", "scoredById", "taskId", "workerId") SELECT "createdAt", "id", "score", "scoredById", "taskId", "workerId" FROM "normal_task_scores";
DROP TABLE "normal_task_scores";
ALTER TABLE "new_normal_task_scores" RENAME TO "normal_task_scores";
CREATE INDEX "normal_task_scores_taskId_idx" ON "normal_task_scores"("taskId");
CREATE UNIQUE INDEX "normal_task_scores_taskId_subtaskId_key" ON "normal_task_scores"("taskId", "subtaskId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
