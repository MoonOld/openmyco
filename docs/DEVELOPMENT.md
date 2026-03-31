# OpenMyco - 开发指南

## 开发环境设置

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器

```bash
# Web 模式（推荐日常开发）
npm run dev:web
# 访问 http://localhost:5173/

# Electron 桌面模式
npm run dev:electron
# 自动打开 Electron 窗口

# 默认模式（等同于 Electron 模式）
npm run dev
```

### 3. 构建生产版本

```bash
# 使用 Makefile（推荐）
make build-web    # 仅构建 Web 版本
make build-win    # 构建 Windows 安装包
make build-mac    # 构建 macOS DMG
make build-linux  # 构建 Linux AppImage/DEB

# 或使用 npm 脚本
npm run build:web      # 仅构建 Web 版本
npm run build          # 构建当前平台 Electron 应用
npm run build:dir      # 构建但不打包（快速测试）
```

> **注意**：在 WSL2 中构建 Windows 安装包可能会遇到 NSIS 兼容性问题，推荐使用 GitHub Actions 进行跨平台构建。

### 4. 运行测试
```bash
npm test              # 监视模式
npm run test:run       # 运行一次
npm run test:coverage  # 覆盖率报告
```

### 5. 代码检查
```bash
npm run lint
```

## 平台开发模式

### Web 开发
- 使用 `npm run dev:web` 启动
- 所有浏览器开发者工具可用
- 快速热更新
- 适合日常开发调试

### Electron 开发
- 使用 `npm run dev:electron` 启动
- 自动打开独立窗口
- 可测试桌面特有功能
- 需要 GUI 环境（WSL 需额外配置）

## 代码规范

### TypeScript
- 使用 `strict: true` 模式
- 所有函数和变量必须有明确的类型
- 优先使用 `type` 而非 `interface`（除非需要继承）

### 命名约定
| 类型 | 约定 | 示例 |
|------|------|------|
| 组件 | PascalCase | `KnowledgeGraph.tsx` |
| 工具函数 | camelCase | `formatDate()` |
| 类型 | PascalCase | `KnowledgeNode` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_LLM_CONFIG` |
| 文件夹 | camelCase | `components/graph/` |

### 文件组织
- 一个文件一个主要 export（组件或类型）
- 相关的辅助函数放在同一文件
- 测试文件放在 `__tests__` 子目录

## 添加新功能

### 1. 添加新组件
```bash
# 1. 创建组件文件
touch src/components/myFeature/MyComponent.tsx

# 2. 导出
# src/components/myFeature/index.tsx
export { MyComponent } from './MyComponent'
```

### 2. 添加新的 Store 状态
```typescript
// src/stores/myFeatureStore.ts
import { create } from 'zustand'

interface MyFeatureState {
  value: string
  setValue: (value: string) => void
}

export const useMyFeatureStore = create<MyFeatureState>((set) => ({
  value: '',
  setValue: (value) => set({ value }),
}))
```

### 3. 添加 LLM 功能
1. 在 `src/lib/llm/client.ts` 添加新方法
2. 在 `src/lib/llm/prompts.ts` 添加 prompt 模板
3. 在 `src/lib/llm/parsers.ts` 添加响应解析器
4. 在 `src/services/operationService.ts` 添加操作入口（如需新操作类型，同步更新 `operationStore.ts` 的 `OperationType`）
5. 编写测试验证

### 3.1 扩展/深化双状态模型
节点有两个独立的操作状态：
- `expandStatus`：扩展操作（骨架获取 + 去重 + 写入节点/边），mutationType 为 `'structure'`
- `deepenStatus`：深化操作（深度内容 + 关联描述），mutationType 为 `'content'`

CAS 并发控制通过 `activeExpandOpId` / `activeDeepenOpId` 实现，两个操作互不干扰。

服务层 API：
- `expandOnly(nodeId)` — 只做骨架
- `deepenOnly(nodeId, { force? })` — 只做内容，`force=true` 时跳过"已深化"拦截
- `expandNode(nodeId)` — 组合入口：expandOnly → deepenOnly

### 4. 添加测试
```typescript
// src/components/myFeature/__tests__/MyComponent.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### 5. 添加 Electron 功能
```typescript
// 1. 在 electron/preload.js 暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  myNewFeature: (data) => ipcRenderer.invoke('my-new-feature', data),
})

// 2. 在 electron/main.js 处理 IPC
ipcMain.handle('my-new-feature', async (event, data) => {
  // 处理逻辑
  return result
})

// 3. 添加 TypeScript 类型
// src/types/electron.d.ts
export interface ElectronAPI {
  myNewFeature: (data: SomeType) => Promise<ResponseType>
}
```

## 调试技巧

### 1. 查看 Store 状态
```typescript
// 在组件中
const state = useKnowledgeStore()
console.log('Current graph:', state.currentGraph)

// 或使用 Zustand DevTools
// 需要安装 Redux DevTools 扩展
```

### 2. 查看 IndexedDB 数据
```javascript
// 在浏览器控制台
import db from './src/lib/storage/db'
db.graphs.toArray().then(graphs => console.log(graphs))
```

### 3. Electron 调试
- 按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (Mac) 打开 DevTools
- 主进程日志在终端中查看
- 渲染进程使用浏览器 DevTools

## 常见问题

### Q: 图谱显示空白？
A: 检查：
1. 是否已配置 API Key
2. API 请求是否成功（查看 Network 面板）
3. LLM 返回的 JSON 格式是否正确

### Q: 类型错误 "Cannot find module"？
A: 运行 `npm run build` 检查 TypeScript 编译

### Q: 测试失败 persist 相关？
A: 测试环境中的 localStorage 会被 mock，确保在 `src/test/setup.ts` 中正确配置

### Q: Electron 在 WSL 中无法启动？
A: WSL 缺少 GUI 库，安装以下依赖：
```bash
sudo apt install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

## 发布流程

### 1. 更新版本号
```bash
# package.json
"version": "1.0.0"
```

### 2. 构建
```bash
# Web 版本
npm run build:web

# Electron 版本
npm run build
```

### 3. 测试构建产物
```bash
# Web
npm run preview

# Electron（运行未打包版本）
./release/linux-unpacked/openmyco         # Linux
./release/mac/OpenMyco.app                # macOS（x64/universal）
./release/mac-arm64/OpenMyco.app          # macOS（Apple Silicon）
./release/win-unpacked/OpenMyco.exe       # Windows x64
./release/win-arm64-unpacked/OpenMyco.exe # Windows ARM64
```

### 4. 提交代码
```bash
git add .
git commit -m "chore: release v1.0.0"
git tag v1.0.0
git push
```

## 文档同步规范

**重要**：每次功能变动必须同步更新相关文档：

| 变更类型 | 需要更新的文档 |
|---------|---------------|
| 新功能 | `docs/SPEC.md` + `docs/ARCHITECTURE.md` |
| API 变更 | `docs/ARCHITECTURE.md` + `docs/DEVELOPMENT.md` |
| 开发流程/构建配置 | `docs/DEVELOPMENT.md` + `AGENTS.md` + `docs/TASK.md` |
| 新依赖 | `docs/ARCHITECTURE.md` |

## 相关文档

- [产品规格](./SPEC.md)
- [架构设计](./ARCHITECTURE.md)
- [测试文档](./TESTING.md)
