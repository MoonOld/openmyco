# 待办任务

## Bug 修复

- [ ] **LLM Client 测试失败** - `src/lib/llm/__tests__/client.test.ts` 中的测试用例失败（endpoint 探测 mock 问题）
- [ ] **LLM 知识内容深度** - 当前 LLM 返回的知识太浅薄，只有性质描述，缺少具体内容
- [ ] **WSL2 构建 Windows 安装包** - NSIS 多架构打包有兼容性问题，推荐用 GitHub Actions
- [ ] **知识图谱布局优化** - dagre 布局算法有时会产生不理想的结果

## 功能优化

- [ ] **知识图谱布局优化** - 节点多时的布局效果需要进一步优化
- [ ] **图谱导出功能** - 支持导出为图片或 PDF
- [ ] **节点搜索功能** - 在大型图谱中搜索特定节点

## 待开发功能

- [ ] **图谱合并** - 支持合并多个知识图谱
- [ ] **学习路径规划** - 基于知识图谱生成学习路径
- [ ] **笔记功能** - 为每个知识点添加笔记

## 架构优化（P0-P2）

### P0 - 操作上下文与并发安全

- [ ] **操作上下文管理**
  - 问题：切换图谱时，LLM 生成数据会写入错误的图谱
  - 方案：每次生成创建 `operationId`，绑定 `targetGraphId` + `rootNodeId`
  - 状态机：pending → success/failed/cancelled
  - 写入：不看"当前正在看的图谱"，只按 `targetGraphId` 定向提交
  - 提示：跨图谱时 toast 提示"图谱 X 已生成完成"

- [ ] **临时节点生命周期**
  - pending: 显示"生成中"骨架状态
  - success: 保留临时节点 ID，覆盖内容（避免 ID 替换）
  - failed/cancelled: 标记失败，提供"重试/删除"操作

- [ ] **并发安全校验**
  - 提交前校验 `operationId` 仍有效（未被取消/替换）
  - 避免旧请求回写污染新操作
  - 需新增 `operations` 状态管理进行中操作

### P0 - 核心链路稳定性

- [ ] **黄金路径测试：首次生成图谱**
  - 覆盖：`nodes/edges/rootId/selectedNodeId` 一致性
  - 覆盖：临时节点与最终节点关系映射正确
  - 验收：无孤儿边、无重复边、无节点丢失
- [ ] **黄金路径测试：节点展开链路**
  - 覆盖：骨架展示 -> 深度信息填充 -> 持久化
  - 覆盖：并发点击、失败重试、取消/中断
  - 验收：展开状态与图谱状态一致

### P1 - 分层重构

- [ ] **引入应用服务层（application/usecase）**
  - 新增：`src/application/knowledgeGraphService.ts`
  - 迁移：LLM 调用与编排逻辑从 `knowledgeStore` 移出
  - 迁移：持久化调用从 UI/store 分散调用改为 service 统一调用
- [ ] **store 职责收敛为纯状态管理**
  - 保留：`addNodes/addEdges/updateNode/selectNode/...`
  - 移除：直接请求 LLM、跨 store 编排、Repository 写入
- [ ] **UI 调用收敛**
  - 组件仅调用 service 或 store action，不直接编排业务流程

### P1 - 节点身份统一

- [ ] **本地 ID 作为唯一 canonical ID**
  - 规则：图谱内 `node.id` 永不替换
  - 规则：LLM 的 id/ref 仅作输入映射，不直接入图
- [ ] **新增 normalize 层**
  - 新增：`normalizeLLMGraph(raw, context) -> GraphPatch`
  - 功能：`ref/externalId -> localId` 映射
  - 功能：边 `source/target` 全量转换为 localId
- [ ] **移除“删临时节点再加 LLM 节点”策略**
  - 改为：保留临时节点 ID，仅更新 payload（title/description/type 等）

### P2 - 边界收口与文档一致性

- [ ] **去除 Repository 的 UI 副作用**
  - `GraphRepository.save()` 不再 `dispatchEvent`
  - 由上层（service/UI）控制刷新通知
- [ ] **日志治理**
  - 清理核心路径 `console.log`
  - 增加 `debug` 开关控制调试输出
- [ ] **文档同步**
  - 更新 `docs/ARCHITECTURE.md`：真实反映当前展开流程与分层设计
  - 更新数据流图：UI -> Service -> Store/Repository/LLM

### 验收标准（DoD）

- [ ] 核心目录 `src/components/chat`, `src/components/graph`, `src/stores`, `src/lib/llm` 的类型检查通过
- [ ] 黄金路径 E2E：首次生成、节点展开、导入导出均稳定
- [ ] 节点 ID 在生命周期内稳定不变
- [ ] 文档与实现流程一致

---

## 已完成

- [x] **节点详情关系跳转** - 点击前置/后置知识可跳转到该节点的聚焦模式
- [x] **左右边栏隐藏/显示** - Header 中添加切换按钮，支持隐藏左右边栏
- [x] **右侧详情面板可调整宽度** - 拖拽边缘调整宽度，范围 280-500px
- [x] **应用图标设计** - 灯泡+知识节点设计，紫蓝渐变背景

- [x] **节点编辑功能** - 支持编辑节点的标题、描述、类型、难度、学习时间、标签
- [x] **重新布局按钮** - 一键重新组织图谱布局
- [x] **聚焦模式 UI 优化** - 改为分段控制器样式，更清晰
- [x] **骨架节点加载状态** - 显示"正在加载详情..."并禁用探索按钮
- [x] **新建图谱按钮** - 侧边栏添加"新建图谱"按钮
- [x] **输入知识点创建新图谱** - 不再添加到当前图谱，而是创建独立图谱
- [x] **删除图谱 UI 优化** - 移除同步 confirm，不再阻塞 UI
- [x] **侧边栏自动刷新** - 创建图谱后自动更新历史列表
- [x] **Makefile 构建** - 添加 `make build-win` 等便捷命令
- [x] **build:web 修复** - 添加 `--mode electron` 确保 Electron 文件编译

- [x] **分层知识获取 + 并行请求** - 改进 LLM 知识获取架构
  - 分层 Prompt 模板设计（骨架 + 深度 + 关联）
  - 并行请求架构（Promise.all 并行获取）
  - 前端 store 集成，骨架 UI 先显示，深度信息后填充

- [x] **节点聚焦视图** - 选中节点时只展示该节点及其邻居
  - 支持切换聚焦模式/全局视图
  - 可配置显示深度（1-3度邻居）

- [x] **展开按钮 UI 优化** - 使用渐变色按钮 + Sparkles 图标

- [x] **节点位置持久化** - 拖拽后的节点位置保存到 IndexedDB

- [x] **Electron 打包白屏问题** - 修复 preload 脚本 ESM/CJS 兼容性

- [x] **日期序列化问题** - 修复 localStorage 中 Date 对象序列化

- [x] **孤立节点问题** - 自动为无关系的节点创建默认边

- [x] **图谱管理功能** - 支持删除单个图谱和清除所有数据

- [x] **层次化布局** - 使用 dagre 替代圆形布局

- [x] **边标签优化** - 用颜色区分关系类型，右下角添加图例
