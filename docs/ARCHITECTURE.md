# OpenMyco - 架构设计文档

## 目录结构

```
project/
├── electron/                 # Electron 桌面应用
│   ├── main.js               # 主进程入口
│   └── preload.js            # 预加载脚本（安全桥接）
│
├── src/                      # 应用源代码
│   ├── types/                # TypeScript 类型定义
│   │   ├── knowledge.ts      # 知识图谱核心类型
│   │   ├── llm.ts            # LLM API 类型
│   │   ├── storage.ts        # 存储相关类型
│   │   └── electron.d.ts     # Electron API 类型
│   │
│   ├── lib/                  # 基础库/工具
│   │   ├── llm/              # LLM API 调用
│   │   ├── storage/          # IndexedDB 存储
│   │   └── utils.ts          # 工具函数
│   │
│   ├── stores/               # Zustand 状态管理
│   ├── components/           # UI 组件
│   ├── constants/            # 常量定义
│   ├── test/                 # 测试配置
│   ├── App.tsx               # 应用入口
│   └── main.tsx              # React 入口
│
├── docs/                     # 项目文档
│   ├── SPEC.md               # 产品规格说明
│   ├── ARCHITECTURE.md       # 架构设计文档（本文件）
│   ├── DEVELOPMENT.md        # 开发指南
│   └── TESTING.md            # 测试文档
│
├── dist/                     # Web 构建产物
├── dist-electron/            # Electron 构建产物
├── release/                  # Electron 打包输出
├── vite.config.ts            # Vite 配置（支持 Web/Electron 切换）
├── package.json              # 项目配置
└── Makefile                  # 便捷构建命令
```

## Electron 架构

### 进程模型

```
┌─────────────────────────────────────────────┐
│            Electron 窗口                      │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │  Renderer Process (渲染进程)           │  │
│  │  - React + TypeScript                 │  │
│  │  - Vite (开发时热更新)                  │  │
│  │  - window.electronAPI (通过 preload)  │  │
│  │  - IndexedDB (浏览器 API)              │  │
│  └───────────────┬───────────────────────┘  │
│                  ↑ IPC (安全)                │
│  ┌───────────────┴───────────────────────┐  │
│  │  Preload Script (预加载脚本)           │  │
│  │  - contextBridge (隔离层)              │  │
│  │  - 暴露安全的 API 给渲染进程            │  │
│  └───────────────┬───────────────────────┘  │
│                  ↑                            │
│  ┌───────────────┴───────────────────────┐  │
│  │  Main Process (主进程)                 │  │
│  │  - BrowserWindow 管理                 │  │
│  │  - 系统级功能 (文件系统、通知等)         │  │
│  │  - Node.js 环境                         │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 安全模型

| 层级 | 权限 | 说明 |
|------|------|------|
| Main Process | 完全系统权限 | Node.js 环境，可访问文件系统 |
| Preload Script | 有限权限 | 使用 contextBridge 暴露指定 API |
| Renderer Process | 沙箱环境 | 仅浏览器 API + 暴露的 electronAPI |

### 代码共享策略

```
                    ┌─────────────────┐
                    │  共享代码        │
                    │  - src/types    │
                    │  - src/lib      │
                    │  - src/stores   │
                    │  - src/components│
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     ┌────────────────┐            ┌────────────────┐
     │  Web 模式       │            │  Electron 模式  │
     │  浏览器运行     │            │  Electron 窗口  │
     └────────────────┘            └────────────────┘
```

## 核心数据模型

### KnowledgeNode (知识节点)
```typescript
interface KnowledgeNode {
  id: string
  title: string
  description: string
  type: 'concept' | 'skill' | 'tool' | 'theory'
  difficulty?: 1-5
  estimatedTime?: number
  expanded: boolean
  position?: { x, y }
  createdAt: Date
  updatedAt: Date
  // 深度知识字段（可选）
  principle?: string           // 核心原理
  useCases?: string[]          // 使用场景
  examples?: Array<{           // 示例
    title: string
    code?: string
    explanation: string
  }>
  bestPractices?: string[]     // 最佳实践
  commonMistakes?: string[]    // 常见错误
  tags?: string[]              // 标签（用户自定义）
}
```

### KnowledgeEdge (知识关系)
```typescript
interface KnowledgeEdge {
  id: string
  source: string
  target: string
  type: 'prerequisite' | 'postrequisite' | 'related' | 'depends'
  weight?: number
  label?: string
}
```

### KnowledgeGraph (知识图谱)
```typescript
interface KnowledgeGraph {
  id: string
  rootId: string
  nodes: Map<string, KnowledgeNode>
  edges: KnowledgeEdge[]
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}
```

## 模块依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Layout  │  │   Chat   │  │   Graph  │  │ Settings │  │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘  │
└────────┼─────────────┼─────────────┼─────────────┼────────┘
         │             │             │             │
┌────────▼─────────────▼─────────────▼─────────────▼────────┐
│                    State Layer (Zustand)                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────┐ │
│  │ KnowledgeStore   │  │  SettingsStore   │  │ UIStore │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────┬────┘ │
└───────────┼──────────────────┼───────────────────────┼─────┘
            │                  │                       │
┌───────────▼──────────────────▼───────────────────────▼─────┐
│                      Service Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ LLM Service  │  │ Graph Service│  │ Storage Service │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼──────────────────┼────────────┘
          │                 │                  │
┌─────────▼─────────────────▼──────────────────▼────────────┐
│                      External Services                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ OpenAI API   │  │  IndexedDB   │  │   File System   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 状态管理

### knowledgeStore
| 状态 | 说明 |
|------|------|
| `currentGraph` | 当前知识图谱 |
| `selectedNodeId` | 选中的节点 ID |
| `expandedNodeIds` | 已展开的节点集合 |
| `loading` | 加载状态 |
| `error` | 错误信息 |

### settingsStore
| 状态 | 说明 |
|------|------|
| `llmConfig` | LLM API 配置 |
| `theme` | 主题设置 |
| `sidebarCollapsed` | 侧边栏折叠状态 |
| `autoLayout` | 自动布局开关 |

### uiStore
| 状态 | 说明 |
|------|------|
| `settingsDialogOpen` | 设置对话框状态 |
| `exportDialogOpen` | 导出对话框状态 |
| `importDialogOpen` | 导入对话框状态 |
| `toasts` | Toast 通知列表 |

## 数据流

### 知识图谱生成流程
```
用户输入知识点
    ↓
ChatInput.handleSubmit()
    ↓
LLMClient.generateKnowledgeGraph()
    ↓
发送请求到 OpenAI Compatible API
    ↓
parseKnowledgeResponse() 解析 JSON
    ↓
addNodes() + addEdges() 更新状态
    ↓
createGraph() 创建新图谱
    ↓
GraphRepository.save() 持久化
    ↓
React Flow 重新渲染图谱
```

### 节点展开流程
```
用户点击节点展开按钮
    ↓
GraphNode.onExpand()
    ↓
knowledgeStore.toggleExpand(nodeId)
    ↓
更新 expandedNodeIds Set
    ↓
React Flow 更新节点状态
    ↓
触发 LLM 扩展调用 (可选)
```

## 技术选型理由

| 技术 | 理由 |
|------|------|
| React Flow | React 生态最佳图可视化库，TypeScript 支持完善 |
| Zustand | 轻量级状态管理，无模板代码，支持 persist |
| Dexie.js | IndexedDB 的最佳封装，Promise API，TypeScript 支持 |
| Tailwind CSS | 快速开发，与 shadcn/ui 配合良好 |
| Vitest | 与 Vite 完美集成，测试体验最佳 |

## 设计决策记录

### 1. 为什么选择纯本地存储？
- 隐私：知识图谱是个人学习数据，不应离开用户设备
- 简单：无需后端服务器，降低开发和维护成本
- 离线：生成后可离线查看和学习

### 2. 为什么用 Map 而不是 Array 存储节点？
- 性能：O(1) 查找时间
- 便利：通过 ID 直接访问节点

### 3. 为什么 Zustand 而不是 Redux？
- 轻量：无样板代码
- 简单：学习曲线低
- 足够：满足当前状态管理需求

### 4. 为什么将 LLM 配置放在用户本地？
- 灵活：用户可使用任何 OpenAI Compatible API
- 隐私：API Key 不经过任何服务器
- 成本：用户使用自己的 API 配额
