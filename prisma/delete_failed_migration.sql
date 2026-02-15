-- 从迁移历史中移除已删除的迁移记录，避免 Prisma 要求 reset
-- 执行: npx prisma db execute --schema prisma/schema.prisma --file prisma/delete_failed_migration.sql
DELETE FROM _prisma_migrations WHERE migration_name = '20260126120000_add_need_distribute_l1_l2';
