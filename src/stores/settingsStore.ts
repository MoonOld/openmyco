import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LLMConfig } from '@/types'
import { DEFAULT_LLM_CONFIG } from '@/types'

interface SettingsState {
  // LLM Configuration
  llmConfig: LLMConfig

  // UI Preferences
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
  detailPanelCollapsed: boolean  // 右侧详情面板是否折叠
  detailPanelWidth: number  // 右侧详情面板宽度 (px)

  // Graph preferences
  autoLayout: boolean
  showNodeLabels: boolean
  animateEdges: boolean

  // Actions
  setLLMConfig: (config: Partial<LLMConfig>) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleSidebar: () => void
  toggleDetailPanel: () => void
  setDetailPanelWidth: (width: number) => void
  setAutoLayout: (enabled: boolean) => void
  setShowNodeLabels: (show: boolean) => void
  setAnimateEdges: (animate: boolean) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      llmConfig: {
        ...DEFAULT_LLM_CONFIG,
        apiKey: '',
      },
      theme: 'system',
      sidebarCollapsed: false,
      detailPanelCollapsed: false,
      detailPanelWidth: 320,  // 默认宽度 320px
      autoLayout: true,
      showNodeLabels: true,
      animateEdges: true,

      // Actions
      setLLMConfig: (config) =>
        set((state) => ({
          llmConfig: { ...state.llmConfig, ...config },
        })),

      setTheme: (theme) => set({ theme }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      toggleDetailPanel: () =>
        set((state) => ({ detailPanelCollapsed: !state.detailPanelCollapsed })),

      setDetailPanelWidth: (width) =>
        set({ detailPanelWidth: Math.max(240, Math.min(600, width)) }),  // 限制宽度范围 240-600px

      setAutoLayout: (enabled) => set({ autoLayout: enabled }),

      setShowNodeLabels: (show) => set({ showNodeLabels: show }),

      setAnimateEdges: (animate) => set({ animateEdges: animate }),

      resetSettings: () =>
        set({
          llmConfig: {
            ...DEFAULT_LLM_CONFIG,
            apiKey: '',
          },
          theme: 'system',
          sidebarCollapsed: false,
          detailPanelCollapsed: false,
          detailPanelWidth: 320,
          autoLayout: true,
          showNodeLabels: true,
          animateEdges: true,
        }),
    }),
    {
      name: 'settings-storage',
    }
  )
)
