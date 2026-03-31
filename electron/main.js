import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
//
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, '../public')

let win

function createWindow() {
  // 开发环境：使用 build 目录中的图标
  // 生产环境：使用 extraResources 复制的图标
  // Windows 优先使用 .ico，其他平台使用 .png
  const isWindows = process.platform === 'win32'
  const iconExt = isWindows ? 'ico' : 'png'

  const devIconPath = path.join(__dirname, `../build/icon.${iconExt}`)
  const prodIconPath = path.join(process.resourcesPath, `icon.${iconExt}`)
  const iconPath = app.isPackaged ? prodIconPath : devIconPath
  const iconExists = fs.existsSync(iconPath)

  console.log('[Electron] Platform:', process.platform)
  console.log('[Electron] Icon path:', iconPath)
  console.log('[Electron] Icon exists:', iconExists)

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'OpenMyco',
    ...(iconExists && { icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Development: load from Vite dev server
  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // Production: load from built files
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Handle navigation for React Router
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)

    if (parsedUrl.origin !== 'http://localhost:5173' && !app.isPackaged) {
      event.preventDefault()
    }
  })
})
