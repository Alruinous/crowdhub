-- AlterTable
ALTER TABLE "AnnotationResult" ADD COLUMN "isCorrect" BOOLEAN;

-- AlterTable
ALTER TABLE "annotations" ADD COLUMN "requirementVector" JSONB;
ALTER TABLE "annotations" ADD COLUMN "vectorLength" INTEGER;

-- CreateTable
CREATE TABLE "user_annotation_task_abilities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "abilityVector" JSONB NOT NULL,
    "vectorLength" INTEGER NOT NULL,
    "correctCounts" JSONB NOT NULL,
    "totalCounts" JSONB NOT NULL,
    "alphaValues" JSONB NOT NULL,
    "avgScore" REAL NOT NULL DEFAULT 0.5,
    "minScore" REAL NOT NULL DEFAULT 0.5,
    "maxScore" REAL NOT NULL DEFAULT 0.5,
    "totalAnnotations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "user_annotation_task_abilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_annotation_task_abilities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_annotation_task_abilities_taskId_avgScore_idx" ON "user_annotation_task_abilities"("taskId", "avgScore");

-- CreateIndex
CREATE UNIQUE INDEX "user_annotation_task_abilities_userId_taskId_key" ON "user_annotation_task_abilities"("userId", "taskId");

-- CreateIndex
CREATE INDEX "AnnotationResult_annotatorId_isCorrect_idx" ON "AnnotationResult"("annotatorId", "isCorrect");
