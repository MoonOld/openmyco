import { useEffect } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { MainLayout } from './components/layout'
import { ChatInterface } from './components/chat'
import { SettingsDialog, ExportDialog, ImportDialog } from './components/settings'
import { initDB } from './lib/storage'
import { useSettingsStore } from './stores'
import { resumePendingOperations } from './services/operationService'

function App() {
  const { theme } = useSettingsStore()

  // Initialize database and resume pending operations (once on mount)
  useEffect(() => {
    initDB()
      .then(() => resumePendingOperations())
      .catch((error) => {
        console.error('Failed to initialize database or resume operations:', error)
      })
  }, [])

  // Apply theme
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return (
    <ReactFlowProvider>
      <MainLayout>
        <ChatInterface />
        <SettingsDialog />
        <ExportDialog />
        <ImportDialog />
      </MainLayout>
    </ReactFlowProvider>
  )
}

export default App
