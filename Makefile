.PHONY: help dev dev-web dev-electron build build-web build-electron build-win build-mac build-linux lint test test-run clean

help:
	@echo "OpenMyco 构建命令"
	@echo ""
	@echo "开发:"
	@echo "  make dev          启动 Electron 开发模式"
	@echo "  make dev-web      启动 Web 开发服务器 (http://localhost:5173)"
	@echo "  make dev-electron 启动 Electron 开发模式"
	@echo ""
	@echo "构建:"
	@echo "  make build        构建当前平台 Electron 应用"
	@echo "  build-web         仅构建 Web 版本"
	@echo "  build-electron    构建当前平台 Electron 应用"
	@echo "  build-win         构建 Windows 安装包"
	@echo "  build-mac         构建 macOS DMG"
	@echo "  build-linux       构建 Linux AppImage/DEB"
	@echo ""
	@echo "质量检查:"
	@echo "  make lint         ESLint 代码检查"
	@echo "  make test         运行测试 (监视模式)"
	@echo "  make test-run     运行测试 (单次)"
	@echo "  make typecheck    TypeScript 类型检查"
	@echo ""
	@echo "清理:"
	@echo "  make clean        清理构建产物"

# 开发
dev:
	npm run dev

dev-web:
	npm run dev:web

dev-electron:
	npm run dev:electron

# 构建
build:
	npm run build

build-web:
	npm run build:web

build-electron:
	npm run build:electron

build-win:
	npm run build:win

build-mac:
	npm run build:mac

build-linux:
	npm run build:linux

# 质量检查
lint:
	npm run lint

typecheck:
	npx tsc -p tsconfig.app.json --noEmit

test:
	npm test

test-run:
	npm run test:run

# 清理
clean:
	rm -rf dist dist-electron release
	@echo "清理完成"

# 图标
generate-icons:
	npm run generate:icons
