-- CreateTable
CREATE TABLE "annotation_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "points" INTEGER NOT NULL DEFAULT 0,
    "maxWorkers" INTEGER NOT NULL DEFAULT 1,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "publisherId" TEXT NOT NULL,
    "categoryId" TEXT,
    "dataFileId" TEXT,
    "labelFileId" TEXT,
    CONSTRAINT "annotation_tasks_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotation_tasks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "annotation_tasks_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "data_files" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "annotation_tasks_labelFileId_fkey" FOREIGN KEY ("labelFileId") REFERENCES "label_files" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "data_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "columns" JSONB NOT NULL,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "label_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "labelSchema" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "annotation_subtasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "startRow" INTEGER NOT NULL,
    "endRow" INTEGER NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "taskId" TEXT NOT NULL,
    "workerId" TEXT,
    CONSTRAINT "annotation_subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotation_subtasks_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "annotation_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    CONSTRAINT "annotation_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotation_messages_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowIndex" INTEGER NOT NULL,
    "rowData" JSONB NOT NULL,
    "labels" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "annotatorId" TEXT NOT NULL,
    CONSTRAINT "annotations_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "annotation_subtasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotations_annotatorId_fkey" FOREIGN KEY ("annotatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "annotation_tasks_dataFileId_key" ON "annotation_tasks"("dataFileId");

-- CreateIndex
CREATE UNIQUE INDEX "annotation_tasks_labelFileId_key" ON "annotation_tasks"("labelFileId");
