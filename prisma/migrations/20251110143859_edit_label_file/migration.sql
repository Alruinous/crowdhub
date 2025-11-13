/*
  Warnings:

  - You are about to drop the column `labelSchema` on the `label_files` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `label_files` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_label_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_label_files" ("createdAt", "filename", "id", "originalName", "path", "size", "updatedAt") SELECT "createdAt", "filename", "id", "originalName", "path", "size", "updatedAt" FROM "label_files";
DROP TABLE "label_files";
ALTER TABLE "new_label_files" RENAME TO "label_files";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
