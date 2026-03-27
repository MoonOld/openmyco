import { create } from 'zustand'

interface UIState {
  // Dialog states
  settingsDialogOpen: boolean
  exportDialogOpen: boolean
  importDialogOpen: boolean

  // Sidebar state
  sidebarOpen: boolean

  // Toast notifications
  toasts: Toast[]

  // Actions
  setSettingsDialogOpen: (open: boolean) => void
  setExportDialogOpen: (open: boolean) => void
  setImportDialogOpen: (open: boolean) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  settingsDialogOpen: false,
  exportDialogOpen: false,
  importDialogOpen: false,
  sidebarOpen: true,
  toasts: [],

  // Actions
  setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setImportDialogOpen: (open) => set({ importDialogOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: Math.random().toString(36).substring(2) },
      ],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
