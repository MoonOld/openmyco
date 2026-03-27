import { useEffect } from 'react'
import { MainLayout } from './components/layout'
import { ChatInterface } from './components/chat'
import { SettingsDialog, ExportDialog, ImportDialog } from './components/settings'
import { initDB } from './lib/storage'
import { useSettingsStore } from './stores'

function App() {
  const { theme } = useSettingsStore()

  // Initialize database
  useEffect(() => {
    initDB().catch((error) => {
      console.error('Failed to initialize database:', error)
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
    <MainLayout>
      <ChatInterface />
      <SettingsDialog />
      <ExportDialog />
      <ImportDialog />
    </MainLayout>
  )
}

export default App
