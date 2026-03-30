# 待办任务

> **更新时间**: 2026-03-30
> **来源**: Codex 评审 + 历史任务

---

## PR 拆分清单（可排期）

### P0（必须先落地）

#### PR P0-1: 操作上下文强约束
- **标题**: 杜绝跨图谱回写污染
- **改动文件**:
  - `src/services/operationService.ts`
  - `src/stores/operationStore.ts`
  - `src/stores/knowledgeStore.ts`
  - `src/services/__tests__/operationService.test.ts`
- **改动内容**:
  1. 为同一 `graphId + nodeId` 的操作增加版本/失效机制
  2. 在每次异步写入前做 `operationId` 有效性校验
  3. `updateGraphById` 仅按 `targetGraphId` 定向写入
- **风险**: 可能误判为"过期操作"导致写入被拒绝（中风险）
- **验收**:
  - [ ] 并发测试通过：旧请求不会覆盖新请求
  - [ ] 切换到图谱 B 时，图谱 A 后台完成不会污染 B
  - [ ] lint + typecheck + test 全通过

#### PR P0-2: 临时节点生命周期统一
- **标题**: pending/success/failed/cancelled 状态机
- **改动文件**:
  - `src/types/knowledge.ts`
  - `src/services/operationService.ts`
  - `src/components/graph/GraphNode.tsx`
  - `src/components/graph/KnowledgeGraph.tsx`
  - `src/components/graph/__tests__/KnowledgeGraph.test.tsx`
- **改动内容**:
  1. 临时节点全流程状态机化
  2. 成功时保留原临时节点 ID，只覆盖内容
  3. UI 明确区分"加载中/失败/已完成"交互态
- **风险**: UI 状态与 store 状态不一致（中风险）
- **验收**:
  - [ ] 失败节点可重试且不生成新 node id
  - [ ] 不出现"删临时节点再新建"的行为
  - [ ] 相关组件测试通过

#### PR P0-3: 黄金路径回归测试
- **标题**: 首图生成 + 节点展开链路测试
- **改动文件**:
  - `src/services/__tests__/operationService.test.ts`
  - `src/stores/__tests__/knowledgeStore.test.ts`
  - `src/lib/llm/__tests__/client.test.ts`
  - `src/test/setup.ts`
- **改动内容**:
  1. 增加首次生成与展开链路回归用例（含失败重试、并发点击）
  2. 校验 `nodes/edges/rootId/selectedNodeId` 一致性
  3. 修复 LLM client 端点探测 mock 不稳定问题
- **风险**: 测试 mock 复杂度上升（低-中风险）
- **验收**:
  - [ ] 无孤儿边、无重复边、无节点丢失
  - [ ] `npm run test:run` 稳定通过（连续跑 2 次结果一致）

---

### P1（结构性重构）

#### PR P1-1: 引入应用服务层
- **标题**: Store 收敛为纯状态管理
- **改动文件**:
  - `src/application/knowledgeGraphService.ts`（新增）
  - `src/application/index.ts`（新增）
  - `src/stores/knowledgeStore.ts`
  - `src/components/chat/ChatInput.tsx`
  - `src/components/graph/KnowledgeGraph.tsx`
- **改动内容**:
  1. 把 LLM 编排 + 持久化 + 事件分发迁到 `application` 层
  2. `knowledgeStore` 仅保留状态变更 action
  3. UI 改为调用 service/usecase
- **风险**: 调用路径迁移面广（中风险）
- **验收**:
  - [ ] `knowledgeStore` 不再直接 import LLM/Repository
  - [ ] 创建图谱、展开节点、切换图谱行为与当前一致
  - [ ] 全量 lint/typecheck/test 通过

#### PR P1-2: 节点 ID 统一策略
- **标题**: normalize 层强化
- **改动文件**:
  - `src/lib/normalizers/llmGraphNormalizer.ts`
  - `src/services/operationService.ts`
  - `src/types/knowledge.ts`
  - `src/lib/normalizers/__tests__/llmGraphNormalizer.test.ts`（新增）
- **改动内容**:
  1. 明确本地 `node.id` 为唯一 canonical ID
  2. LLM ref/externalId 仅做映射，不直接入图
  3. 边统一转换为 localId，并加去重/无效引用过滤
- **风险**: 边过滤可能导致关系数量下降（低-中风险）
- **验收**:
  - [ ] 节点从临时到成功生命周期内 ID 不变
  - [ ] ref 缺失/脏数据场景下不产生脏边
  - [ ] normalizer 新增回归测试通过

#### PR P1-3: UI 调用边界收口
- **标题**: 组件不直连存储层
- **改动文件**:
  - `src/components/layout/Sidebar.tsx`
  - `src/components/settings/ImportDialog.tsx`
  - `src/components/settings/ExportDialog.tsx`
  - `src/application/knowledgeGraphService.ts`
- **改动内容**:
  1. 组件不再直接调用 `GraphRepository` / `importGraphFromJson`
  2. 导入、导出、删除、选择图谱统一经 service
  3. 错误提示与成功提示统一处理
- **风险**: Sidebar 刷新时机变化（中风险）
- **验收**:
  - [ ] 组件层不再出现存储层直接调用
  - [ ] 导入/导出/删除/切换图谱流程回归通过

---

### P2（边界治理与文档收尾）

#### PR P2-1: Repository 去 UI 副作用
- **标题**: 事件上移到应用层
- **改动文件**:
  - `src/lib/storage/repositories.ts`
  - `src/types/events.ts`
  - `src/application/knowledgeGraphService.ts`
  - `src/components/layout/Sidebar.tsx`
- **改动内容**:
  1. 移除 `GraphRepository.save()` 内部 `window.dispatchEvent`
  2. 由 application/service 在明确场景主动发事件
  3. 统一事件语义（structure/content/meta）
- **风险**: 若遗漏事件触发点会导致 UI 不刷新（中风险）
- **验收**:
  - [ ] 新建/更新/删除/导入后 Sidebar 都能正确刷新
  - [ ] Repository 仅负责数据读写，无 UI 行为

#### PR P2-2: 日志治理与 debug 开关
- **标题**: 统一日志系统
- **改动文件**:
  - `src/lib/logger.ts`（新增）
  - `src/stores/settingsStore.ts`
  - `src/services/operationService.ts`
  - `src/stores/knowledgeStore.ts`
  - `src/components/graph/KnowledgeGraph.tsx`
  - `src/lib/llm/client.ts`
- **改动内容**:
  1. 用统一 logger 替换散落 `console.log`
  2. 增加 `debugMode` 配置，按开关输出调试日志
  3. 保留 error 级日志，便于线上定位
- **风险**: 日志减少后排查成本短期上升（低风险）
- **验收**:
  - [ ] `debugMode=false` 时无冗余调试日志
  - [ ] `debugMode=true` 时关键链路日志完整含 `operationId`

#### PR P2-3: 文档与实现对齐
- **标题**: 架构/开发/测试文档同步
- **改动文件**:
  - [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
  - [docs/DEVELOPMENT.md](./DEVELOPMENT.md)
  - [docs/TESTING.md](./TESTING.md)
  - [docs/TASK.md](./TASK.md)
  - [AGENTS.md](../AGENTS.md)
- **改动内容**:
  1. 同步最新分层：`UI -> Application -> Store/Repository/LLM`
  2. 更新并发模型、节点生命周期、测试矩阵
  3. 把本次 PR 计划转为可追踪实施清单
- **风险**: 若延期合并文档易再次滞后（低风险）
- **验收**:
  - [ ] 文档评审通过，能指导新同学完整跑通开发流程
  - [ ] 文档中的命令与当前仓库实际可执行一致

---

## 版本规划

### v0.2.0 - 架构稳定性
完成 PR P0-1/P0-2/P0-3（操作上下文、临时节点生命周期、回归测试）

### v0.3.0 - 架构重构
完成 PR P1-1/P1-2/P1-3（应用服务层、节点ID策略、UI边界收口）

### v0.4.0 - 边界治理
完成 PR P2-1/P2-2/P2-3（Repository副作用、日志治理、文档对齐）

### v1.0.0 - 知识深度 ⭐ 首个稳定版
**核心目标**: 让 LLM 生成的知识有深度，不只是性质描述

- [ ] **Prompt 工程** - 优化 LLM prompt，生成更深度的知识内容
- [ ] **知识结构设计** - 每个知识点应包含：
  - 核心概念解析
  - 实际应用场景
  - 常见误区/陷阱
  - 与其他知识的深层关联
  - 学习资源推荐
- [ ] **多轮对话探索** - 支持对单个知识点深入追问

---

## 发布流程

- [ ] **CHANGELOG** - 添加 CHANGELOG.md 记录版本变更
- [ ] **GitHub Actions** - 自动构建多平台安装包
- [ ] **GitHub Release** - 通过 GitHub Releases 分发安装包

---

## Bug 修复

- [ ] **WSL2 构建 Windows 安装包** - NSIS 多架构打包兼容性问题，推荐 GitHub Actions
- [ ] **知识图谱布局优化** - dagre 布局算法有时会产生不理想的结果

---

## 功能优化

- [ ] **图谱导出功能** - 支持导出为图片或 PDF
- [ ] **节点搜索功能** - 在大型图谱中搜索特定节点
- [ ] **性能优化** - Zustand selector 优化、批量状态提交

---

## 待开发功能

- [ ] **图谱合并** - 支持合并多个知识图谱
- [ ] **学习路径规划** - 基于知识图谱生成学习路径
- [ ] **笔记功能** - 为每个知识点添加笔记

---

## 安全性改进（来自 Codex 评审）

- [ ] **API Key 安全** - 考虑提供"本地代理/服务端转发"可选模式
- [ ] **LLM 请求超时** - 统一超时控制，避免异常链路悬挂
- [ ] **Electron CSP** - 增加 CSP 与导航/新窗口拦截

---

## 验收标准（DoD）

- [ ] 核心目录 `src/components/chat`, `src/components/graph`, `src/stores`, `src/lib/llm` 的类型检查通过
- [ ] 黄金路径 E2E：首次生成、节点展开、导入导出均稳定
- [ ] 节点 ID 在生命周期内稳定不变
- [ ] 文档与实现流程一致

---

