# 迁移与 schema 状态说明

## 1. 移除 `20260126120000_add_need_distribute_l1_l2` 后，服务器上会不会少两列？

**不会。** 这两列会在后面的迁移里被加上。

- 已删除的迁移 `20260126120000_add_need_distribute_l1_l2` 原本只做一件事：给 `annotations` 表增加 `needDistributeL1`、`needDistributeL2`。
- 后面的 **`20260212080212_`** 会**整表重建** `annotations`，在新表定义里已经包含这两列（以及 needToReview2、resultConfirmed、finalResult 等），并设默认值 `false`。
- 因此：只要服务器按顺序执行现有 26 个迁移，执行到 `20260212080212_` 时就会得到带 `needDistributeL1`、`needDistributeL2` 的 `annotations` 表，**不依赖**已删除的那条迁移。

结论：本地/服务器从 `_prisma_migrations` 里移除或从未应用过 `20260126120000_add_need_distribute_l1_l2` 都没问题，不会少列。

---

## 2. annotations 表在各迁移中的演变（与 schema 一致）

| 迁移 | annotations 表变化 |
|------|---------------------|
| 20260116130426_ | needToReview；无 needToReview2 / needDistributeL1 / needDistributeL2 / resultConfirmed / finalResult |
| 20260126044111_ | 仅重定义，列同上 |
| 20260202122520_ | 增加 completedAt |
| 20260207071754_ | 去掉 completedAt；增加 resultConfirmed, finalResult |
| 20260207074121_ | 增加 needToReview2 |
| **20260212080212_** | **增加 needDistributeL1, needDistributeL2；与当前 schema 一致** |

当前 `schema.prisma` 里的 `Annotation`（needToReview, needToReview2, needDistributeL1, needDistributeL2, resultConfirmed, finalResult 等）与 **20260212080212_** 执行完后的表结构一致。

---

## 3. 正确的迁移目录状态（当前应为这样）

- **迁移个数**：共 **26 条**（已删除 `20260126120000_add_need_distribute_l1_l2`）。
- **每条迁移**：各自目录下必须有且仅有一个 **migration.sql**，不要缺文件，否则会报 P3015。
- **顺序**：按文件夹名字（时间戳）从小到大依次应用，最终由 **20260212080212_** 得到与当前 schema 一致的 `annotations` 表。

建议每次改迁移或部署前跑一次：

```bash
pnpm db:check-migrations
```

确保没有“空目录缺 migration.sql”的情况。

---

## 4. 数据库里应做的清理（你本地已做 / 要做的事）

- 若本地 dev.db 的 **`_prisma_migrations`** 里还有 **`20260126120000_add_need_distribute_l1_l2`** 这条记录（无论是 applied 还是 failed），需要删掉这条记录，否则 Prisma 会认为“有一条已应用但本地没有的迁移”而要求 reset。
- 删除方式：执行一次 `prisma/delete_failed_migration.sql`（或等价 SQL），例如：
  ```bash
  npx prisma db execute --schema prisma/schema.prisma --file prisma/delete_failed_migration.sql
  ```
- 服务器上：若从未应用过 `20260126120000_add_need_distribute_l1_l2`，则不需要做任何清理，直接按现有 26 条迁移 `migrate deploy` 即可。

---

## 5. 总结

- **schema.prisma** 与 **最后一版 annotations 表（20260212080212_）** 一致，无需改 schema。
- **迁移目录**：保留当前 26 条即可，不要再恢复已删的 `20260126120000_add_need_distribute_l1_l2`。
- **服务器**：直接 `prisma migrate deploy`，会按顺序执行这 26 条，最终表结构会包含 needDistributeL1、needDistributeL2，不会少列。
- **本地**：执行 `delete_failed_migration.sql` 清理 `_prisma_migrations` 中那条已删迁移的记录后，再 `migrate dev` / `migrate deploy` 即可。
