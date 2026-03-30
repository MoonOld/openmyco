import { useEffect, useRef } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { MainLayout } from './components/layout'
import { ChatInterface } from './components/chat'
import { SettingsDialog, ExportDialog, ImportDialog } from './components/settings'
import { initDB } from './lib/storage'
import { useSettingsStore, useKnowledgeStore } from './stores'
import { resumePendingOperations } from './services/operationService'

function App() {
  const { theme } = useSettingsStore()
  const { currentGraph } = useKnowledgeStore()
  const resumedGraphIdRef = useRef<string | null>(null)

  // Initialize database
  useEffect(() => {
    initDB().catch((error) => {
      console.error('Failed to initialize database:', error)
    })
  }, [])

  // Resume pending operations when graph changes
  useEffect(() => {
    if (currentGraph && currentGraph.id !== resumedGraphIdRef.current) {
      resumedGraphIdRef.current = currentGraph.id
      resumePendingOperations().catch((error) => {
        console.error('Failed to resume pending operations:', error)
      })
    }
  }, [currentGraph])

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
