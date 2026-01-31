# 标注流程与撤销逻辑说明

## 一、从标注页加载到正确性更新的全流程

### 1. 发放（sendAnnotatioinToUser）
- 调度器按周期运行，对每条 `annotation` 若 `publishedCount < requiredCount` 则调用 `sendAnnotatioinToUser`。
- 创建 `AnnotationResult`（仅 `annotationId`, `annotatorId`），无 selections，`isFinished` 默认 false。
- `annotation.publishedCount += 选中的用户数`。
- 「某天发放」= 该用户在该任务下的 `AnnotationResult.createdAt` 落在某天的那些记录。

### 2. 标注页加载（get-annotation-data）
- 查询该用户在该任务下 **isFinished = false** 的 `AnnotationResult`，按 `createdAt` 排序。
- 前端用这些结果逐条展示，每条对应一个「条目」可标注。

### 3. 保存（save-annotations）
- 对每条提交：按 `annotationResultId` 找到 `AnnotationResult`，校验未完成、属于该任务。
- 删除该 result 下原有 `AnnotationSelection`，再按提交的 selections 新建。
- `AnnotationResult`：`isFinished = true`，`completedAt = now()`。
- 若更新成功（原先是未完成）：`annotation.completedCount += 1`。

### 4. 正确性更新（checkAnnotationCorrectness）
- 调度器或手动「更新任务状态」时，对每条 `annotation` 若 `completedCount === requiredCount` 则调用。
- 取该 annotation 下所有 **isFinished = true** 的 `AnnotationResult` 及 selections。
- 用维度 0、维度 1 的第一级分类比较两人是否一致 → 一致则两人都正确，否则都错误。
- 更新每个 `AnnotationResult.isCorrect`（true/false）。
- 调用 **updateUserAbilities**：按维度 0 的分类名（correctDim0）对该任务下 correct/incorrect 用户做能力更新：`totalCounts[category] += 1`，若正确则 `correctCounts[category] += 1`，再贝叶斯重算 `abilityVector[category]` 及 avgScore/minScore/maxScore/totalAnnotations。
- 更新 **Annotation**：`status = COMPLETED`，`needToReview = !allMatch`。

---

## 二、撤销「某用户某天发放的所有 AnnotationResult」需要改什么

目标：让这些结果视为「未完成」，该用户重新标注后，会再次参与 completedCount 与正确性检查。

### 必须修改的

1. **AnnotationResult**（对每个被撤销的、且当前 isFinished=true 的记录）
   - `isCorrect = null`，`isFinished = false`，`completedAt = null`。
   - **删除** 该 result 下的所有 **AnnotationSelection**（否则会残留旧选项，重新标注会冲突或导出/统计混乱）。

2. **Annotation**（对每个被撤销的 result 所属的 annotation）
   - `completedCount -= 1`（每撤销一条已完成的 result 就减 1）。
   - 若减后 `completedCount < requiredCount`：  
     `status = PENDING`，`needToReview = false`（该条不再处于「已检查」状态）。
   - 可选但建议：此时把该 annotation 下**所有** `AnnotationResult` 的 `isCorrect` 置为 `null`，避免留下「已检查」的假象（另一人的 isCorrect 会在该用户重新提交后由 checkAnnotationCorrectness 重算）。

3. **UserAnnotationTaskAbility**（能力回滚）
   - checkAnnotationCorrectness 里对每个已完成的 result 调用了 updateUserAbilities，即对该用户在该任务下按「维度 0 分类」做了 +1 统计。
   - 撤销时需要对**同一用户、同一任务、同一分类**做一次反向操作：  
     在**删 selections 之前**用该 result 的 selections 读出维度 0 的第一级分类名（与 correctDim0 同源），再对该用户在该任务的能力记录：  
     - `totalCounts[category] -= 1`  
     - 若该 result 的 `isCorrect === true`，则 `correctCounts[category] -= 1`  
     - 用现有公式重算 `abilityVector[category]` 以及 avgScore/minScore/maxScore/totalAnnotations 并写回。  
   - 不做的后果：该用户能力统计多算了一次，后续分配和统计会偏。

### 不需要修改的

- **publishedCount**：撤销的是「完成状态」，不是「发放」。AnnotationResult 仍存在，用户仍被分配该条，因此 publishedCount 不变。
- **AnnotationResult 的删除**：不删 result 本身，只清空完成状态和 selections，这样该用户仍拥有这条任务，重新标注会更新同一条 result。

### 小结表

| 对象 | 操作 |
|------|------|
| AnnotationResult（被撤销且原 isFinished=true） | isCorrect=null, isFinished=false, completedAt=null；并删除其下所有 AnnotationSelection |
| Annotation | completedCount -= 1；若 completedCount < requiredCount 则 status=PENDING, needToReview=false；可选：该 annotation 下所有 result 的 isCorrect=null |
| UserAnnotationTaskAbility | 按该 result 的维度 0 分类回滚：totalCounts[category]-=1，若 isCorrect 则 correctCounts[category]-=1，重算 abilityVector 等并更新 |
| publishedCount | 不改 |

「某天」建议用 `AnnotationResult.createdAt` 的日期（按任务所在时区或 UTC 截断到日）筛选要撤销的 result。
