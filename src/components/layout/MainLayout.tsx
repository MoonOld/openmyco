import React from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useSettingsStore, useUIStore } from '@/stores'
import { Toast, ToastContainer } from '@/components/ui'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed } = useSettingsStore()
  const { toasts, removeToast } = useUIStore()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <div className="w-64 border-r bg-background/95 backdrop-blur">
            <Sidebar className="h-full" />
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </ToastContainer>
    </div>
  )
}
