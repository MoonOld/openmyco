<h1 align="center">OpenMyco</h1>

<p align="center">
  <b>English</b> | <a href="README.md">中文</a>
</p>

<p align="center">
  <img src="build/icon.svg" width="128" height="128" alt="OpenMyco Logo">
</p>

<p align="center">
  <strong>Let Knowledge Grow Like Mycelium</strong>
</p>

<p align="center">
  <em>让知识像菌丝一样生长</em>
</p>

---

## What is OpenMyco?

**OpenMyco** is an AI-powered knowledge graph learning tool. Enter any topic, and the AI automatically builds a related knowledge network, visualized as an interactive graph with recursive exploration support.

```
Input: "React Hooks"
     ↓
AI generates knowledge network
     ↓
     useState ── useEffect
        │           │
    useReducer   useCallback
        │           │
     useContext ── useMemo
```

## Key Features

- 🧠 **AI-Powered** - Automatically builds knowledge structure through LLM
- 🕸️ **Knowledge Graph** - Visualizes relationships between concepts
- 🔄 **Recursive Exploration** - Click nodes to dive deeper
- 💾 **Local Storage** - Data stored in IndexedDB, privacy protected
- 🌐 **Offline Available** - View and learn offline after generation
- 🖥️ **Cross-Platform Desktop** - Windows, macOS, Linux supported

## Quick Start

```bash
# Install dependencies
npm install

# Start Electron desktop app (recommended)
npm run dev:electron
```

> **Note**: Web mode (`npm run dev:web`) cannot directly call LLM APIs due to browser CORS restrictions. Electron mode is recommended.

## Build

```bash
npm run build        # Current platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 19 + TypeScript | Frontend Framework |
| Zustand | State Management |
| React Flow | Graph Visualization |
| Dexie.js | IndexedDB Storage |
| Tailwind CSS + shadcn/ui | UI Components |
| Electron | Desktop Application |

## Brand Story

**Myco** comes from *Mycelium* - the underground fungal network.

Mycelium is nature's most fascinating network structure. Beneath the surface, countless tiny filaments interconnect, forming vast networks for information and nutrient exchange. This is the perfect metaphor for knowledge learning:

- **Distributed** - Knowledge points are inherently interconnected
- **Organic Growth** - From one point, the entire network grows
- **Resilience** - More connections mean a stronger network

> "Knowledge is like mycelium—invisible yet everywhere. One thought, and everything connects."

## Documentation

Detailed documentation in the `docs/` directory:

- [Product Spec](docs/SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Testing](docs/TESTING.md)
- [Build Guide](BUILD.md)

## License

MIT
