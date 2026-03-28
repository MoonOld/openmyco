#!/bin/bash
# 在 WSL 上构建后修复 Windows exe 图标
# electron-builder 在 WSL 上可能无法正确设置图标

EXE_PATH="release/win-unpacked/OpenMyco.exe"
ICO_PATH="build/icon.ico"
RCEDIT_PATH="$HOME/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0/rcedit-x64.exe"

if [ ! -f "$EXE_PATH" ]; then
    echo "Windows exe not found, skipping icon fix"
    exit 0
fi

if [ ! -f "$RCEDIT_PATH" ]; then
    echo "rcedit not found, skipping icon fix"
    exit 0
fi

echo "Setting Windows exe icon..."

# 使用 Wine 运行 rcedit 设置图标
WINEDEBUG=-all wine "$RCEDIT_PATH" "$(pwd)/$EXE_PATH" --set-icon "$(pwd)/$ICO_PATH" 2>/dev/null

echo "Icon set successfully!"
