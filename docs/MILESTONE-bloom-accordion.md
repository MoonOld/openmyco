# 里程碑：布鲁姆认知递进 + Accordion

> **状态**: 进行中
> **分支**: `plan/bloom-accordion`
> **GitHub Milestone**: Bloom 认知递进 + Accordion

---

## 1. 问题诊断

### 1.1 布鲁姆认知层级分析

当前右边栏 Tab 结构按数据类型组织（概览/原理/示例/实践），与学习认知过程脱节。

| 布鲁姆层级 | 当前覆盖 | 评估 |
|------------|----------|------|
| Remember | description, tags | 较好 |
| Understand | principle, keyTerms | 较好 |
| Apply | examples, useCases | 中等 |
| Analyze | — | **缺失** |
| Evaluate | commonMistakes/bestPractices（被动列表） | **严重缺失** |
| Create | — | **缺失** |

### 1.2 核心问题

- Tab 结构按数据类型组织，不反映学习认知递进
- Analyze/Evaluate/Create 层严重缺失
- commonMistakes/bestPractices 只是被动列表，缺乏主动引导

## 2. 解决方案

### 2.1 分层 Prompt 策略

```
Layer 1 (基础深化) — 用户点击"深化"时触发
  现有字段: description, principle, keyTerms, subTopics, useCases,
           examples, bestPractices, commonMistakes
  新增:     analogies (类比理解)

Layer 2 (高阶深化) — 用户在 Accordion 中点击"获取高阶内容"时触发
  新增:     reflectionPrompts (反思引导), challenge (挑战任务)
```

### 2.2 Accordion 面板结构

按布鲁姆认知递进组织内容：

```
▼ 认识 (默认展开) — Remember + Understand
  ├─ description (描述)
  ├─ tags (标签)
  ├─ analogies (新增，类比理解)
  └─ keyTerms (关键术语)

▶ 原理 (默认折叠) — Understand 深层
  ├─ principle (核心原理)
  └─ subTopics (子话题)

▶ 应用 (默认折叠) — Apply
  ├─ useCases (应用场景)
  ├─ examples (代码示例)
  ├─ bestPractices (最佳实践)
  └─ commonMistakes (避坑指南)

▶ 关系 (默认折叠)
  ├─ incomingEdges (前置知识)
  ├─ outgoingEdges (后续知识)
  └─ estimatedTime (预计学习时间)

▶ 反思与挑战 (默认折叠) — Evaluate + Create [Layer 2 按需获取]
  ├─ [获取高阶内容] 按钮（未获取时显示）
  ├─ reflectionPrompts (反思引导)
  └─ challenge (挑战任务)

▼ 探索 (默认展开)
  └─ QAPanel
```

## 3. 数据模型变更

### 3.1 新增字段

```typescript
// Layer 1 字段（基础深化时获取）
analogies?: Array<{
  analogy: string       // 类比描述
  mapsTo: string        // 映射到的概念
  limitation?: string   // 类比的局限
}>

// Layer 2 字段（高阶深化时获取）
reflectionPrompts?: Array<{
  question: string
  level: 'surface' | 'deep' | 'transfer'
  hint?: string
}>

challenge?: {
  title: string
  description: string
  difficulty: 'guided' | 'open' | 'extended'
  requirements: string[]
  extensions?: string[]
  suggestedApproach?: string
}
```

### 3.2 操作状态字段

```typescript
advancedDeepenStatus?: 'idle' | 'loading' | 'success' | 'error'
advancedDeepenError?: string
```

## 4. 实施步骤

| Step | 内容 | 文件 |
|------|------|------|
| 0 | 里程碑文档 + 分支 | `docs/MILESTONE-bloom-accordion.md` |
| 1 | Accordion UI 组件 | `src/components/ui/accordion.tsx` |
| 2 | 扩展数据模型 | `src/types/knowledge.ts` |
| 3 | 扩展 LLM Prompt | `src/lib/llm/prompts.ts` |
| 4 | 扩展解析器 | `src/lib/llm/parsers.ts` |
| 5 | 扩展 Client | `src/lib/llm/client.ts` |
| 6 | 扩展服务层 | `src/services/operationService.ts` |
| 7 | 扩展 Store | `src/stores/knowledgeStore.ts` |
| 8 | 重写 NodeDetailPanel | `src/components/graph/NodeDetailPanel.tsx` |
| 9 | 更新测试 | 测试文件 |
| 10 | 更新文档 | `docs/SPEC.md` + `docs/ARCHITECTURE.md` |

## 5. 关键设计决策

| 决策 | 理由 |
|------|------|
| 自定义 Accordion 而非 Radix | 与现有 tabs.tsx 风格一致，不引入新依赖 |
| Layer 2 用简单状态字段而非 CAS 锁 | 用户主动触发，并发风险极低 |
| grid-template-rows 动画 | 现代 CSS，与 Tailwind 配合良好，无需 JS 测量 |
| 新字段全部 optional | 向后兼容，无需 IndexedDB migration |

## 6. 向后兼容

- 新字段全部 optional，旧数据不受影响
- 无 IndexedDB migration
- Layer 2 是纯增量，不影响现有深化流程
- 旧节点没有 analogies 时面板正常显示

## 7. 验证方式

1. `npm run lint` — 无 error
2. `npx tsc -p tsconfig.app.json --noEmit` — 类型检查通过
3. `npm run test:run` — 所有测试通过
4. 手动测试:
   - 创建图谱 → 深化节点 → 验证 Accordion 面板展示 + analogies 内容
   - 展开"反思与挑战"面板 → 点击"获取高阶内容" → 验证 reflectionPrompts + challenge
   - 验证旧数据兼容性（已有节点不报错）

## 8. 未来扩展 (Phase 2+)

后续可继续添加布鲁姆 Analyze/Evaluate 层字段：
- `comparisons` — 系统对比分析（Analyze）
- `tradeOffs` — 权衡评判（Evaluate）
- `decomposition` — 结构分解（Analyze）
- `connections` — 跨领域连接（Create）
- `quickReference` — 速查卡（Remember）

这些字段将纳入 Layer 2 Prompt，按需获取。
