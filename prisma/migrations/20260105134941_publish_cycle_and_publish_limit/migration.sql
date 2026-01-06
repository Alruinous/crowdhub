-- AlterTable
ALTER TABLE "annotation_tasks" ADD COLUMN "publishCycle" INTEGER DEFAULT 1;
ALTER TABLE "annotation_tasks" ADD COLUMN "publishLimit" INTEGER DEFAULT 100;
