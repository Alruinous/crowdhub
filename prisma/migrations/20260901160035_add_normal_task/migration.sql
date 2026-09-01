-- CreateTable
CREATE TABLE "normal_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "points" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "publisherId" TEXT NOT NULL,
    CONSTRAINT "normal_tasks_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "normal_subtasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT,
    CONSTRAINT "normal_subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "normal_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "normal_subtasks_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "normal_task_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "scoredById" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "normal_task_scores_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "normal_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "normal_task_scores_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "normal_task_scores_taskId_idx" ON "normal_task_scores"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "normal_task_scores_taskId_workerId_key" ON "normal_task_scores"("taskId", "workerId");
