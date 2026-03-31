# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OpenMyco** - 交互式知识图谱学习工具

通过 LLM 问答进行知识学习的结构化平台。用户输入知识点，LLM 分析返回相关知识体系，以可视化知识图谱展示，支持递归扩展。

- **前端**: React 19 + TypeScript 5.9 + Vite
- **状态管理**: Zustand
- **图可视化**: React Flow
- **本地存储**: Dexie.js (IndexedDB)
- **UI 组件**: shadcn/ui + Tailwind CSS
- **测试**: Vitest + Testing Library
- **桌面框架**: Electron (可选)

## Development Commands

```bash
# Web 开发模式 (推荐日常使用)
npm run dev:web         # 启动 Vite 开发服务器 (http://localhost:5173)

# Electron 桌面模式
npm run dev:electron    # 启动 Electron 桌面应用

# 默认模式 (等同于 Electron 模式)
npm run dev

# 构建
npm run build:web       # 仅构建 Web 版本
npm run build           # 构建 Electron 应用 (含安装包)
npm run build:dir       # 构建但不打包 (快速测试)

# 代码检查
npm run lint

# 测试
npm test                # 监视模式
npm run test:run        # 运行一次
npm run test:coverage   # 覆盖率报告
```

## 项目文档

详细设计文档请参考 `docs/` 目录：

- **[docs/SPEC.md](./docs/SPEC.md)** - 产品规格说明，功能需求和非功能需求
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - 架构设计，目录结构，数据模型，技术选型理由
- **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** - 开发指南，代码规范，添加新功能流程
- **[docs/TESTING.md](./docs/TESTING.md)** - 测试策略，测试覆盖范围，最佳实践

## Architecture

### 目录结构
```
project/
├── electron/           # Electron 桌面应用
│   ├── main.js         # 主进程入口
│   └── preload.js      # 预加载脚本 (安全桥接)
│
├── src/
│   ├── types/          # TypeScript 类型定义
│   ├── lib/            # 工具库 (LLM, storage, utils)
│   ├── stores/         # Zustand 状态管理
│   ├── components/     # UI 组件 (graph, chat, layout, settings, ui)
│   ├── constants/      # 常量定义
│   ├── test/           # 测试配置
│   ├── App.tsx         # 应用入口
│   └── main.tsx        # React 入口
│
├── docs/               # 项目文档
│   ├── SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   └── TESTING.md
│
├── dist/               # Web 构建产物
├── dist-electron/      # Electron 构建产物
└── release/            # Electron 打包输出
```

### 核心模块
- **lib/llm/** - LLM API 调用、Prompt 模板、响应解析
- **lib/storage/** - IndexedDB 封装 (Dexie.js)
- **services/operationService.ts** - 操作管理（创建图谱、扩展、深化），依赖方向：UI → Service → Store
- **stores/** - knowledgeStore, settingsStore, uiStore, operationStore
- **components/graph/** - React Flow 图可视化组件

### TypeScript Configuration
- `tsconfig.app.json`: Source code compilation (ES2023 target, strict mode, JSX via react-jsx)
- `tsconfig.node.json`: Vite config files (vitest.config.ts, vite.config.ts)
- `strict: true` enabled with `noUnusedLocals` and `noUnusedParameters`

### Entry Points
- `index.html`: HTML entry point that mounts `#app` root
- `src/main.tsx`: React application entry (renders `App` component)
- `src/App.tsx`: Root application component with database initialization and theme setup

### LLM Integration
- 使用 OpenAI Compatible API
- 配置通过 settingsStore 持久化到 localStorage
- 支持 stream 和 non-stream 请求模式

### Storage
- IndexedDB (Dexie.js) 用于存储知识图谱
- localStorage 用于存储用户设置
- 支持导出/导入 JSON 格式

## Testing

### Test Structure
```
src/
├── test/                    # 测试配置
│   └── setup.ts
├── lib/__tests__/           # 工具函数测试
│   └── utils.test.ts
├── lib/llm/__tests__/       # LLM 模块测试
│   └── parsers.test.ts
└── stores/__tests__/        # 状态管理测试
    ├── knowledgeStore.test.ts
    ├── settingsStore.test.ts
    └── toggleExpand.test.ts
```

### Test Coverage
- lib/utils.ts: ~90%
- lib/llm/parsers.ts: ~95%
- stores/: ~85%

### Mock Strategy
- IndexedDB (Dexie) 被 mock
- localStorage 被 mock
- LLM API 调用可被 mock 进行测试

## Code Conventions

### 命名约定
- 组件: PascalCase (e.g., `KnowledgeGraph.tsx`)
- 工具函数: camelCase (e.g., `formatDate()`)
- 类型: PascalCase (e.g., `KnowledgeNode`)
- 常量: UPPER_SNAKE_CASE (e.g., `DEFAULT_LLM_CONFIG`)

### Import Order
1. React imports
2. Third-party imports
3. Absolute imports (@/...)
4. Relative imports (./...)
5. Type-only imports (type {...})

### Component Structure
```typescript
// Imports
import { useEffect } from 'react'

// Types
interface Props {
  // ...
}

// Component
export function MyComponent({ prop }: Props) {
  // Hooks
  // Handlers
  // Render
  return <div>...</div>
}
```

## Development Workflow

### 代码修改后必做检查

每次修改代码后，必须按顺序执行以下检查：

1. **Lint 检查**
   ```bash
   npm run lint
   ```
   - 修复所有 error 级别问题
   - warning 级别问题需评估是否修复

2. **类型检查**
   ```bash
   npx tsc -p tsconfig.app.json --noEmit
   ```
   - 确保无 TypeScript 类型错误

3. **单测检查**
   - 如果修改了业务逻辑，评估是否需要新增/修改测试
   - 运行所有测试确保无回归：
     ```bash
     npm run test:run
     ```

4. **构建验证** (重要变更时)
   ```bash
   npm run build
   ```

### 测试覆盖原则

| 修改类型 | 是否需要新增测试 |
|----------|------------------|
| 工具函数 (lib/utils, lib/llm) | **必须** |
| Store actions/reducers | **必须** |
| 纯 UI 样式调整 | 不需要 |
| 简单组件重构 | 评估决定 |
| Bug 修复 | **必须**添加回归测试 |

## Development Notes

- 所有状态修改通过 Zustand store actions 进行
- 组件保持无状态，从 store 读取数据
- LLM 调用通过 lib/llm/client.ts 进行
- 本地存储操作通过 lib/storage/repositories.ts 进行
- 图布局使用 React Flow 的自动布局 + 手动调整

### 文档同步规范

每次功能变动后，必须同步更新 `docs/` 目录中的相关文档：

| 变更类型 | 需要更新的文档 |
|---------|---------------|
| 新功能/需求变更 | `docs/SPEC.md` |
| 架构/模块变更 | `docs/ARCHITECTURE.md` |
| API/开发方式变更 | `docs/DEVELOPMENT.md` + `CLAUDE.md` |
| 构建配置变更 | `docs/DEVELOPMENT.md` + `CLAUDE.md` |
| 测试策略变更 | `docs/TESTING.md` |

**原则**: 文档即代码，功能变动必须同步更新文档，确保文档与代码一致。
