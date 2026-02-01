# 复审功能设计思路（仅一级复审）

## 一、整体流程

```
两人标注完成 → 结果不一致 → 标记 needToReview
    → 将 needToReview 的条目发给一级复审员
    → 一级复审员完成一条 → 得到三个结果（2 标注员 + 1 复审员）
    → 对三个结果做多数决判定 → 更新各人 isCorrect、needToReview
```

**二次复审（暂不开发）**：完成三个结果的多数决后，若**仍无法确定每个维度的分类**（如三人三个答案、无多数），则后续可引入二级复审员；当前阶段不实现。

---

## 二、当前标注逻辑（不变）

1. **发放**：`sendAnnotatioinToUser` 为每条 annotation 创建 `AnnotationResult`（标注员）。
2. **标注页**：标注员看到自己 `isFinished=false` 的 results，选维度、提交。
3. **保存**：`save-annotations` 写 selections、置 `isFinished=true`、`annotation.completedCount += 1`。
4. **正确性**：当 `completedCount === requiredCount` 时，`checkAnnotationCorrectness`：
   - 取该 annotation 下 **2 个** 已完成的 result，比较维度 0/1 第一级；
   - **一致** → 两人都正确，`needToReview=false`，**更新能力向量**（此时已确定正确答案）；
   - **不一致** → 两人都错误，`needToReview=true`，**不更新能力向量**（此时尚未确定正确答案，等复审后多数决再更新）；
   - 更新各 result 的 `isCorrect`、`annotation.status=COMPLETED`。

这样两人不一致时只打标 needToReview，不更新能力；复审后多数决再对第一维度做能力更新。

---

## 三、一级复审要做的内容

### 3.1 数据模型（最小改动）

- **AnnotationResult** 增加字段 **`round`**（Int，默认 0）：
  - `round = 0`：标注员的结果（现有数据）；
  - `round = 1`：一级复审员的结果。
- **唯一约束** 从 `(annotationId, annotatorId)` 改为 **`(annotationId, annotatorId, round)`**。  
  这样：同一人在同一条目上最多一条「标注」、一条「复审」；标注员写 round=0，复审员写 round=1。

**Annotation** 表暂不增加 needL2Review 等字段，只沿用现有 `needToReview`。

### 3.2 任务与一级复审员的关系（采用方案 B）

- 采用 **方案 B**：新建表 **`AnnotationTaskReviewer(taskId, userId, level)`**，level=1 表示一级。
- 可建索引 `(taskId, level)`、`(userId, taskId)`，便于「按任务查复审员」和「按用户查其复审任务」，大量数据下查询效率高；扩展二级时加 level=2 即可。

### 3.3 将 needToReview 的条目「发给」一级复审员（采用方案 B）

- **含义**：对每条 `needToReview=true` 且尚未存在 round=1 的 result 的 annotation，为其**创建一条** `round=1` 的 `AnnotationResult`，`annotatorId` = 某一位一级复审员，`isFinished=false`。
- **时机**：采用 **定时任务**，**每天 0 点**自动发放（与现有标注发放周期一致，或复用同一调度入口、在 processTask 中增加「发放复审」步骤）。
- **分配策略**：
  1. **尽量平均**：按该任务的一级复审员数量均分待发放条目。例如待发放 N 条、复审员 K 人，则每人目标约 N/K 条（整除余数可摊给前几人或最后几人）。
  2. **尽量连续**：待发放的 annotation 按 **rowIndex 升序**（或主键顺序）排序后，**按段连续分配**，避免把同一批数据打散。例如排序后得到列表 `[a1, a2, …, aN]`，复审员按固定顺序编号 `R1..RK`，则：第 1 段（前 N/K 条）分给 R1，第 2 段分给 R2，…，这样每人拿到的是一段连续的 rowIndex 区间，便于复审员按顺序处理、体验上「连在一起」。
- **实现要点**：
  - 按任务维度：对每个任务分别取「needToReview=true 且尚无 round=1 的 annotation」，按 rowIndex 排序，再按上述分段规则为每条创建 round=1 的 AnnotationResult（annotatorId = 该段对应的复审员）。
  - 复审员顺序：可从 AnnotationTaskReviewer 中按 userId 或录入顺序取固定顺序，保证同一任务多次发放时分段一致；若希望更均衡，可按「当前该任务下该复审员已有 round=1 未完成数量」升序排，再分段（则本次发放中未完成少的先被分配）。
- 这样复审员在「待复审列表」里看到的，就是自己 `round=1` 且 `isFinished=false` 的 result 对应的条目，且这些条目在 rowIndex 上尽量连续。

### 3.4 一级复审员提交结果

- 复审员在「复审页」选维度、提交，与标注员**同一套保存逻辑**：
  - 写 selections、置该条 `AnnotationResult.isFinished=true`（这条 result 的 round=1）。
- **不**改 `annotation.completedCount`（completedCount 只统计标注员人数）；如需统计「是否已有复审结果」，可单独用「该 annotation 下是否存在 round=1 且 isFinished=true 的 result」判断。

### 3.5 三个结果的多数决判定

- **触发时机**：当某条 annotation 上存在 **2 条 round=0 已完成 + 1 条 round=1 已完成**（共 3 条 result）时，对该条执行一次「多数决」正确性判定。
- **判定逻辑**（与现有注释中的 3 人逻辑一致）：
  1. 取该 annotation 下所有 `isFinished=true` 的 results（此时为 2 个 round=0 + 1 个 round=1）。
  2. 提取每个 result 的维度 0、维度 1 的**第一级分类**（与现有逻辑一致）。
  3. **多数决**：对维度 0、维度 1 分别用 `findMajorityAnswer`：≥2 人相同则该维度的「正确答案」为该值，否则为 null（无法确定）。
  4. 对每个 result：若两个维度都等于对应「正确答案」，则判为正确，否则错误。
  5. 写回每个 `AnnotationResult.isCorrect`；更新标注员能力向量（仅 round=0 的 userId，见下）；`annotation.needToReview` 可置为 false（或保留为「多数决仍无法确定时」后续给二级用，当前可先置 false）。

**实现方式**（少改现有代码）：

- 在 `annotation-scheduler` 中抽一个 **`evaluateAnnotationCorrectnessByMajority(annotationId, taskId)`**（或类似命名）：
  - 入参：annotationId、taskId；
  - 内部：查询该 annotation 下所有已完成的 results（不区分 round），提取维度 0/1 第一级，调用 `findMajorityAnswer`，返回 `{ correctUserIds, incorrectUserIds, correctDim0, needFurtherReview }`。
- **何时调用**：
  - 方案 A：在「保存复审结果」的接口里，当检测到该 annotation 已有 2 个 round=0 完成 + 1 个 round=1 完成时，调用 `evaluateAnnotationCorrectnessByMajority`，再根据返回写回 DB；
  - 方案 B：复审员提交后，只写 result；由定时或手动「重算正确性」任务扫描「恰好 3 条已完成」的 annotation 并调用上述函数。
- **现有 `checkAnnotationCorrectness`**：仅当该 annotation 下已完成的 result 数为 2 时调用（保持当前两人一致/不一致逻辑）；当 result 数为 3 时不再调用原逻辑，改为调用 `evaluateAnnotationCorrectnessByMajority`。  
  或者：不在标注保存时区分 2/3，统一一个入口，内部根据 result 数量分支——2 人用现有一致/不一致，≥3 人用多数决。

### 3.6 能力向量

- **两人一致时**：在 `checkAnnotationCorrectness` 里按现有逻辑更新标注员能力（第一维度）。
- **两人不一致时**：不更新能力向量，因为此时还没确定正确答案；等一级复审完成、多数决后，再根据多数决结果对**第一维度**更新标注员（round=0）的能力。
- **复审员**：不参与能力统计（只对 round=0 的 result 更新能力），改动最小。

---

## 四、接口与前端（一级复审）

- **复审员待复审列表**：  
  GET 某任务下，当前用户作为**一级复审员**且 `annotation.needToReview=true`，且存在该用户的一条 `round=1` 且 `isFinished=false` 的 AnnotationResult 的条目（或直接查当前用户 round=1 且 isFinished=false 的 results）。
- **复审员提交**：  
 与标注员共用「保存 selections + 置 isFinished」接口；入参需能标识这是对哪条 AnnotationResult 的提交（即 round=1 的 resultId）；提交成功后服务端对该 annotation 判断是否已满足「2 个 round=0 + 1 个 round=1 完成」，若满足则调用多数决逻辑并写回。
- **前端**：  
  - 标注员入口：仅自己的 round=0、isFinished=false（现有逻辑）。  
  - 复审员入口：仅自己的 round=1、isFinished=false；单条复审页与标注页类似（展示条目内容 + 选维度），数据来源为该条 round=1 的 result。

---

## 五、实施顺序建议（仅一级）

1. **Schema**：AnnotationResult 增加 `round`（默认 0），唯一约束改为 `(annotationId, annotatorId, round)`；任务上增加一级复审员配置（如 reviewerIds 或 Reviewer 表 level=1）。
2. **发放复审**：在 `checkAnnotationCorrectness` 里当设置 `needToReview=true` 后，为该 annotation 创建一条 round=1 的 AnnotationResult（分配给某位一级复审员）；或单独任务扫描 needToReview 并创建 round=1。
3. **多数决逻辑**：实现 `findMajorityAnswer` + `evaluateAnnotationCorrectnessByMajority`，并在「复审员提交后」或统一正确性入口中，当 result 数=3 时调用，写回 isCorrect、needToReview、能力向量。
4. **接口**：复审员获取待复审列表、提交复审结果（复用保存 result 的接口，按 resultId 区分 round）。
5. **前端**：复审员任务/待复审列表 + 单条复审页（与标注页共用组件或稍作区分）。

---

## 六、二次复审（后续扩展，本次不实现）

- 当多数决后**仍无法确定每个维度的分类**（如三人三个答案、无多数）时，可将 `needToReview` 保持为 true（或新增 needL2Review），并在此后引入二级复审员：为这些条目创建 round=2 的 AnnotationResult，二级复审员提交后再对「2+1+1」或更多结果做多数决。  
- 当前阶段不开发二级，仅在一级设计与实现上预留扩展空间（round、任务-复审员配置等）。
