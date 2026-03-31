# P1: 知识节点深度内容增强

> **更新时间**: 2026-03-30
> **目标**: 增强知识节点内容维度，支持深入学习

---

## 背景

用户反馈三个核心问题：
1. **关联节点太细** — 有些"关联知识"应该是节点本身的子话题
2. **节点内容维度不足** — 需要公式、原理、应用场景等深度内容
3. **无法互动探索** — 用户不能针对节点提问，不能沉淀知识

**关键发现**: `KnowledgeNode` 已有深维度字段（principle/useCases/examples/bestPractices/commonMistakes），LLM 也已获取这些数据，但 NodeDetailPanel **完全没有展示**。

---

## PR 拆分

| PR | 内容 | 复杂度 | 状态 |
|----|------|--------|------|
| **PR-1** | NodeDetailPanel Tab 化重构 + 展示已有深维度内容 | 中 | ✅ 已合并 |
| **PR-2** | keyTerms 字段 + LLM + 展示 | 低 | ✅ 已合并 |
| **PR-3** | subTopics 数据模型 + LLM + 展示 | 中 | ✅ 已合并 |
| **PR-4** | Q&A 数据模型 + LLM + UI（四选一动作） | 高 | ✅ 已完成 |

---

## PR-1: NodeDetailPanel Tab 化重构 + 展示已有深维度内容

### 目标
将 NodeDetailPanel 从单页面改为 Tab 布局，展示 LLM 已返回但未展示的深维度内容。

### 改动文件
| 文件 | 改动 |
|------|------|
| `src/components/ui/tabs.tsx` | **新增** — Tabs UI 组件 |
| `src/components/ui/index.ts` | 导出 Tabs 组件 |
| `src/components/graph/NodeDetailPanel.tsx` | **重构** — Tab 化，展示深维度内容 |
| `src/components/graph/__tests__/NodeDetailPanel.test.tsx` | **新增** — 组件渲染测试 |

### Tab 布局
1. **概览** (Overview) — description, tags, estimatedTime, 关系
2. **原理** (Principle) — principle 字段
3. **示例** (Examples) — useCases + examples (含代码块)
4. **实践** (Practices) — bestPractices + commonMistakes

### 空状态提示
- 各 Tab 在对应字段为空时显示友好提示，如"暂无原理说明，展开节点后自动获取"
- 概览 Tab 始终有内容（至少有 description）

### 验收标准
- [x] NodeDetailPanel 有 4 个 Tab，可切换
- [x] 每个 Tab 正确展示对应深维度字段
- [x] 空状态有友好提示
- [x] 关系导航功能不受影响
- [x] `npx tsc -p tsconfig.app.json --noEmit` 通过
- [x] `npm run lint` 通过
- [x] `npm run test:run` 通过

---

## PR-2: keyTerms 字段 + LLM + 展示

### 目标
新增 `keyTerms` 字段（关键术语表），LLM 按需返回，在 NodeDetailPanel 中展示。

### 改动文件
| 文件 | 改动 |
|------|------|
| `src/types/knowledge.ts` | KnowledgeNode 新增 `keyTerms` 字段 |
| `src/lib/llm/prompts.ts` | KNOWLEDGE_DEEP_PROMPT 新增 keyTerms 请求 |
| `src/lib/llm/parsers.ts` | parseDeepResponse 新增 keyTerms 解析 |
| `src/lib/llm/client.ts` | getKnowledgeDeep 返回类型新增 keyTerms |
| `src/stores/knowledgeStore.ts` | expandNode 更新 keyTerms |
| `src/components/graph/NodeDetailPanel.tsx` | 概览 Tab 展示 keyTerms |
| `src/lib/llm/__tests__/parsers.test.ts` | 新增 keyTerms 解析测试 |

### 数据模型
```typescript
keyTerms?: Array<{
  term: string       // 术语名称
  definition: string // 简短定义
}>
```

### 验收标准
- [x] KnowledgeNode 类型包含 keyTerms
- [x] parseDeepResponse 正确解析 keyTerms
- [x] NodeDetailPanel 概览 Tab 展示 keyTerms
- [x] 空状态友好提示
- [x] lint + typecheck + test 全通过

---

## PR-3: subTopics 数据模型 + LLM + 展示

### 目标
支持节点的子话题（只做一层，不嵌套），允许将过于细的关联知识归类为子话题。

### 改动文件
| 文件 | 改动 |
|------|------|
| `src/types/knowledge.ts` | KnowledgeNode 新增 `subTopics` 字段 |
| `src/lib/llm/prompts.ts` | 新增 SUBTOPICS_PROMPT |
| `src/lib/llm/parsers.ts` | 新增 parseSubTopicsResponse |
| `src/lib/llm/client.ts` | 新增 getSubTopics 方法 |
| `src/stores/knowledgeStore.ts` | expandNode 更新 subTopics |
| `src/components/graph/NodeDetailPanel.tsx` | 新增子话题 Tab |
| `src/lib/llm/__tests__/parsers.test.ts` | 新增 subTopics 解析测试 |

### 数据模型
```typescript
subTopics?: Array<{
  title: string        // 子话题标题
  description: string  // 简短描述
  keyPoints?: string[] // 要点列表
}>
```

### 验收标准
- [x] KnowledgeNode 类型包含 subTopics
- [x] LLM 可返回子话题数据
- [x] NodeDetailPanel 展示子话题
- [x] lint + typecheck + test 全通过

---

## PR-4: Q&A 数据模型 + LLM + UI（四选一动作）

### 目标
支持用户针对节点提问，回答后可选动作：仅保存 / 合并到字段 / 生成 subTopic / 升级为新节点。

### 改动文件
| 文件 | 改动 |
|------|------|
| `src/types/knowledge.ts` | 新增 QAActionType, MergeableField, KnowledgeQA 类型 |
| `src/lib/llm/prompts.ts` | 新增 QA_PROMPT（含上下文：节点描述、原理摘要、历史问答） |
| `src/lib/llm/parsers.ts` | 新增 parseQAResponse + QAResponse 类型 |
| `src/lib/llm/client.ts` | 新增 askQuestion 方法 |
| `src/stores/knowledgeStore.ts` | 新增 qaLoadingNodes, qaError 状态 + askQuestion, executeQAAction actions |
| `src/components/graph/QAPanel.tsx` | **新增** — Q&A 面板组件（提问输入 + 待处理/历史列表 + 四选一按钮） |
| `src/components/graph/NodeDetailPanel.tsx` | 新增问答 Tab，引入 QAPanel |
| `src/lib/llm/__tests__/parsers.test.ts` | 新增 parseQAResponse 测试 |
| `src/stores/__tests__/knowledgeStore.test.ts` | 新增 askQuestion + executeQAAction 测试 |

### Q&A 数据模型
```typescript
type QAActionType = 'save_only' | 'merge_to_field' | 'generate_subtopic' | 'upgrade_to_node'
type MergeableField = 'principle' | 'useCases' | 'bestPractices' | 'commonMistakes'

interface KnowledgeQA {
  id: string
  question: string
  answer: string
  action: QAActionType
  actionResult?: string    // 执行动作后的结果描述
  mergedField?: MergeableField  // merge_to_field 时记录目标字段
  createdAt: Date
}
```
> 注意：QA 存储在 `KnowledgeNode.qas` 数组中，跟随节点持久化，无需独立的存储层。

### 四选一动作 UI
- 用户提问后，LLM 返回回答 + 建议动作（suggestedAction + suggestedField）
- 显示回答 + 建议标签 + 4 个动作按钮
- 选择 `merge_to_field` 时，展开二级按钮选择目标字段（principle/useCases/bestPractices/commonMistakes）
- 选择动作后执行对应操作，QA 移入「历史问答」

### 验收标准

#### 数据模型与类型
- [x] `QAActionType` 和 `MergeableField` 类型定义完整且被正确导出
- [x] `KnowledgeQA` 接口包含所有字段（id, question, answer, action, actionResult?, mergedField?, createdAt）
- [x] `KnowledgeNode.qas` 为可选数组字段，类型为 `KnowledgeQA[]`
- [x] persist merge 正确处理 `qas[].createdAt` 的 Date 反序列化

#### LLM Prompt 与解析
- [x] `QA_PROMPT` 包含节点标题、描述、原理摘要、历史问答上下文
- [x] `QA_PROMPT` 要求 LLM 返回 JSON（answer, suggestedAction, suggestedField?）
- [x] `parseQAResponse` 正确解析有效响应，answer 为空时返回 null
- [x] `parseQAResponse` 将无效 suggestedAction 降级为 `save_only`
- [x] `parseQAResponse` 仅在 suggestedAction 为 `merge_to_field` 时保留 suggestedField
- [x] `parseQAResponse` 支持 markdown code fence 包裹的响应

#### LLM Client
- [x] `LLMClient.askQuestion` 正确组装 system + user message 并调用 `parseQAResponse`
- [x] `askQuestion` 接受 qaHistory 和 principleSummary 参数传递给 prompt

#### Store Actions — askQuestion
- [x] API Key 未配置时设置 `qaError` 并提前返回
- [x] 加载期间 `qaLoadingNodes` 正确添加/移除节点 ID
- [x] LLM 返回有效响应后，QA 记录追加到 `node.qas` 数组
- [x] QA 记录包含正确的 question、answer、suggestedAction、suggestedField
- [x] 操作完成后持久化到 IndexedDB
- [x] 节点不存在时不调用 LLM

#### Store Actions — executeQAAction
- [x] `save_only`：标记 `actionResult = 'saved'`，不修改节点其他字段
- [x] `merge_to_field` + field：合并回答到对应字段（principle 追加文本，其他追加到数组）
- [x] `merge_to_field` 无 field 参数时提前返回，不修改数据
- [x] `generate_subtopic`：在 `node.subTopics` 数组追加新子话题（title 截取自 question，description 截取自 answer）
- [x] `upgrade_to_node`：创建新 KnowledgeNode + KnowledgeEdge（type=related, weight=0.7），添加到图谱
- [x] 每个动作都标记 QA 的 `actionResult`
- [x] 操作完成后持久化到 IndexedDB

#### UI — QAPanel 组件
- [x] 提问输入框（Textarea）+ 提交按钮（Enter 快捷键提交）
- [x] 加载中状态显示"思考中..."，禁用输入和按钮
- [x] 错误状态显示 qaError 信息
- [x] 待处理 QA 列表：显示 question、answer、建议动作标签、4 个动作按钮
- [x] `merge_to_field` 点击后展开二级字段选择按钮（principle/useCases/bestPractices/commonMistakes）
- [x] 历史问答列表：可折叠（details/summary），显示 question、answer、actionResult
- [x] 空状态提示："对这个知识点提问，深入探索"

#### UI — NodeDetailPanel 集成
- [x] Tab 栏新增"问答"Tab（MessageCircle 图标）
- [x] 问答 Tab 使用 QAPanel 组件，传入正确的 nodeId

#### 测试覆盖
- [x] `parseQAResponse` 测试：有效响应、save_only、merge_to_field、无效 action 降级、空 answer 返回 null、code fence 包裹、非 JSON 内容
- [x] `askQuestion` store 测试：成功追加 QA、API Key 缺失报错、节点不存在不调用 LLM
- [x] `executeQAAction` store 测试：save_only、merge_to_field（principle + useCases）、缺 field 提前返回、generate_subtopic、upgrade_to_node

#### 质量门禁
- [x] `npx tsc -p tsconfig.app.json --noEmit` 通过
- [x] `npm run lint` 通过
- [x] `npm run test:run` 通过

---

## 测试策略

每个 PR 包含对应的单元测试：
- **PR-1**: NodeDetailPanel 组件渲染测试（各 Tab 是否展示、空状态提示）
- **PR-2**: parseDeepResponse 新增 keyTerms 测试
- **PR-3**: parseDeepResponse 新增 subTopics 测试
- **PR-4**: parseQAResponse 测试 + Q&A 交互逻辑测试

## 验证

每个 PR 完成后：
```bash
npx tsc -p tsconfig.app.json --noEmit
npm run lint
npm run test:run
```

---

## Ideas / 设计备忘

### 关联节点 vs 子话题：边界划分

**问题**：当前 skeleton 阶段（关联节点）和 deep 阶段（subTopics）的边界模糊。LLM 可能把同一概念同时作为关联节点和子话题返回，或者把「包含当前知识的上层概念」作为关联节点。

**核心原则**：
- **关联节点（图上的节点）= 外部依赖**。学这个知识点之前/之后需要先去别处学的东西。粒度要匹配或更细，不能更粗。
  - ✅ 前置：「命题逻辑」「基本证明方法」→ 学集合论之前需要掌握
  - ❌ 前置：「离散数学」→ 这是集合论的上层容器，不是前置依赖
  - ❌ 前置：「数学」→ 过于抽象
- **子话题（节点内部）= 内部构成**。当前知识点自身的组成部分，学它就是在学这些东西。要完整、具体、能自足支撑理解。
  - ✅ 「集合运算」「关系与函数」「基数」→ 集合论的内部构成
- **不要出现的**：包含当前知识点的上层概念，不应作为关联节点

**实施方向**：
- [ ] skeleton prompt 增加判断标准：关联节点 ≠ 上层概念，粒度 ≥ 当前知识点
- [ ] deep prompt 的 subTopics 要求完整覆盖内部构成
- [ ] skeleton 阶段明确告知 LLM："关联节点是外部依赖，内部构成由 subTopics 处理"

### 关联节点不应引入过于抽象/总括的上层概念

> **场景举例**：学习「零知识证明」时，LLM 可能会把它关联到「密码学」这个极其宽泛的父概念。但用户实际学习路径中，真正需要的是「椭圆曲线」→「双线性配对」→「特定曲线的性质」这样的**具体依赖链**，而不是把整个密码学拖进来变成一个巨大的关联节点。

**核心观点**：
- 关联知识应该聚焦于**直接相关、可操作的具体概念**，而非笼统的上位概念
- 过于抽象的父概念（如"密码学""数学""计算机科学"）只会让图谱膨胀，增加认知负担
- Prompt 中应引导 LLM 倾向于输出**细粒度的具体依赖**，而非宽泛的学科分类

### 展开节点时应避免创建重复节点

> **场景**：当节点 A 展开后产生了节点 B 和 C。然后用户展开节点 B，LLM 又返回了节点 A 和 C 作为关联节点。此时图中会出现两个 A 和两个 C，造成重复。

**核心问题**：当前 `expandNode` 的 Skeleton 阶段虽然传入了 `adjacentNodes`（已有相邻节点列表）并在 prompt 中要求「避免重复」，但 LLM 仍然可能返回标题相同或高度相似的节点。

**解决方向**：
1. **Prompt 级别**：在 Skeleton prompt 中更强调「以下节点已存在于图谱中，不要重复生成」，并列出**所有**已有节点（不只是相邻节点）
2. **后处理去重**：在 parser 或 normalizer 层，将 Skeleton 返回的节点标题与图谱中已有节点做匹配（精确匹配 + 模糊匹配），命中的跳过创建新节点，改为复用已有节点 ID 并只添加新的边关系
3. **数据流**：`expandNode` → Skeleton → 拿到 relatedTitles → 与 `graph.nodes` 比对 → 重复的用已有 ID，新的创建新节点 → 写入 store
