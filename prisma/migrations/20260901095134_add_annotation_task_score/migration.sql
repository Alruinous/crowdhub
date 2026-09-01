-- CreateTable
CREATE TABLE "annotation_task_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "scoredById" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "annotation_task_scores_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotation_task_scores_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "annotation_task_scores_taskId_idx" ON "annotation_task_scores"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "annotation_task_scores_taskId_workerId_key" ON "annotation_task_scores"("taskId", "workerId");
