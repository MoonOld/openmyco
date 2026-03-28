# OpenMyco 打包构建指南

## 支持平台

| 平台 | 架构 | 状态 |
|------|------|------|
| Windows | x64, arm64 | ✅ 支持 |
| macOS | x64, arm64, universal | ✅ 支持 |
| Linux | AppImage, deb | ✅ 支持 |

## 构建要求

### 通用依赖
```bash
npm install
```

### Linux 构建 Windows 版本 (交叉编译)
需要安装 Wine:

```bash
# Ubuntu/Debian
sudo apt-get install wine

# Fedora
sudo dnf install wine

# Arch Linux
sudo pacman -S wine
```

## 构建命令

### 当前平台
```bash
# 构建当前平台的 Electron 应用
npm run build

# 或只构建不打包 (用于测试)
npm run build:dir
```

### 指定平台
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 仅 Web 版本
```bash
npm run build:web
```

## 输出位置

构建产物位于 `release/` 目录：

- **Windows**: `release/OpenMyco Setup 0.1.0.exe`
- **macOS**: `release/OpenMyco-0.1.0.dmg`
- **Linux**: `release/OpenMyco-0.1.0.AppImage`

## 交叉编译说明

### 从 Linux 构建 Windows
- 需要 Wine 6.0+
- 运行 `npm run build:win`
- 生成 NSIS 安装程序

### 从 Linux 构建 macOS
- **不支持** - macOS 构建必须在 macOS 上进行
- 可以使用 GitHub Actions 的 macOS runner

### 从 Windows 构建 Linux
- 完全支持，无需额外依赖
- 运行 `npm run build:linux`

### 从 macOS 构建 Windows/Linux
- 完全支持，无需额外依赖

## 应用图标

图标文件需要放置在 `build/` 目录：

| 平台 | 图标文件 | 尺寸建议 |
|------|----------|----------|
| Windows | `build/icon.ico` | 256x256 |
| macOS | `build/icon.icns` | 1024x1024 |
| Linux | `build/icons/*.png` | 512x512 |

### 生成图标

使用在线工具或 CLI 工具：

```bash
# 使用 png2ico (Windows)
png2ico icon.ico icon-256.png

# 使用 iconutil (macOS)
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
# ... (其他尺寸)
iconutil -c icns icon.iconset

# Linux 自动使用 PNG
cp icon.png build/icons/
```

推荐在线工具: [favicon.io](https://favicon.io/) 或 [ezyzip.com](https://www.ezyzip.com/)

## CI/CD 构建

### GitHub Actions 示例

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: release/*
```

## 故障排除

### Wine 问题 (Linux → Windows)
```bash
# 检查 Wine 版本
wine --version

# 初始化 Wine (首次使用)
winecfg
```

### macOS 代码签名
```bash
# 安装 Xcode 后获取证书
# 在 package.json 中添加:
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

### Linux AppImage 不运行
```bash
# 赋予执行权限
chmod +x release/OpenMyco-*.AppImage

# 如果仍有问题，提取内容检查
./OpenMyco-*.AppImage --appimage-extract
```
