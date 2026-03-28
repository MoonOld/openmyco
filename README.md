# OpenMyco

<p align="center">
  <b>中文</b> | <a href="README_EN.md">English</a>
</p>

<p align="center">
  <img src="build/icon.svg" width="128" height="128" alt="OpenMyco Logo">
</p>

<p align="center">
  <strong>让知识像菌丝一样生长</strong>
</p>

<p align="center">
  <em>Let knowledge grow like mycelium.</em>
</p>

---

## 什么是 OpenMyco？

**OpenMyco** 是一个 AI 驱动的知识图谱学习工具。输入任意知识点，AI 将自动构建相关知识网络，以可视化图谱展示，支持递归扩展探索。

```
输入: "React Hooks"
     ↓
AI 生成知识网络
     ↓
     useState ── useEffect
        │           │
    useReducer   useCallback
        │           │
     useContext ── useMemo
```

## 核心特性

- 🧠 **AI 驱动** - 通过 LLM 问答自动构建知识体系
- 🕸️ **知识图谱** - 可视化展示知识点之间的关系
- 🔄 **递归扩展** - 点击节点可继续深入探索
- 💾 **本地存储** - 数据存储在本地 IndexedDB，保护隐私
- 🌐 **离线可用** - 生成后可离线查看和学习
- 🖥️ **跨平台桌面** - 支持 Windows、macOS、Linux

## 快速开始

```bash
# 安装依赖
npm install

# 启动 Electron 桌面应用（推荐）
npm run dev:electron
```

> **注意**: Web 模式 (`npm run dev:web`) 因浏览器 CORS 限制，无法直接调用 LLM API。推荐使用 Electron 模式。

## 构建

```bash
npm run build        # 当前平台
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 技术栈

| 技术 | 用途 |
|------|------|
| React 19 + TypeScript | 前端框架 |
| Zustand | 状态管理 |
| React Flow | 图可视化 |
| Dexie.js | IndexedDB 存储 |
| Tailwind CSS + shadcn/ui | UI 组件 |
| Electron | 桌面应用 |

## 品牌故事

**Myco** 来自 *Mycelium*（菌丝网络）。

菌丝是自然界最神奇的网络结构——在地表之下，无数微小的菌丝相互连接，形成庞大的信息与营养交换网络。这正是知识学习的完美隐喻：

- **分布式** - 知识点之间本就相互关联
- **有机生长** - 从一个点，长出整片网络
- **强健性** - 连接越多，网络越稳固

> "知识就像菌丝，看不见却无处不在，一念起，万物相连。"

## 开发文档

详细文档请参考 `docs/` 目录：

- [产品规格](docs/SPEC.md)
- [架构设计](docs/ARCHITECTURE.md)
- [开发指南](docs/DEVELOPMENT.md)
- [测试文档](docs/TESTING.md)
- [构建指南](BUILD.md)

## License

MIT
