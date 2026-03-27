import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettingsStore } from '../settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { resetSettings } = useSettingsStore.getState()
    resetSettings()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useSettingsStore())

      expect(result.current.llmConfig.baseURL).toBe('https://api.openai.com/v1')
      expect(result.current.llmConfig.model).toBe('gpt-4o-mini')
      expect(result.current.llmConfig.apiKey).toBe('')
      expect(result.current.theme).toBe('system')
      expect(result.current.sidebarCollapsed).toBe(false)
      expect(result.current.autoLayout).toBe(true)
      expect(result.current.showNodeLabels).toBe(true)
      expect(result.current.animateEdges).toBe(true)
    })
  })

  describe('setLLMConfig', () => {
    it('should update LLM config partially', () => {
      const { result } = renderHook(() => useSettingsStore())

      act(() => {
        result.current.setLLMConfig({ apiKey: 'sk-test123' })
      })

      expect(result.current.llmConfig.apiKey).toBe('sk-test123')
      expect(result.current.llmConfig.model).toBe('gpt-4o-mini') // Unchanged
    })

    it('should update multiple config fields', () => {
      const { result } = renderHook(() => useSettingsStore())

      act(() => {
        result.current.setLLMConfig({
          apiKey: 'sk-test',
          model: 'gpt-4',
          temperature: 0.5,
        })
      })

      expect(result.current.llmConfig.apiKey).toBe('sk-test')
      expect(result.current.llmConfig.model).toBe('gpt-4')
      expect(result.current.llmConfig.temperature).toBe(0.5)
    })
  })

  describe('setTheme', () => {
    it('should change theme', () => {
      const { result } = renderHook(() => useSettingsStore())

      act(() => {
        result.current.setTheme('dark')
      })

      expect(result.current.theme).toBe('dark')

      act(() => {
        result.current.setTheme('light')
      })

      expect(result.current.theme).toBe('light')
    })
  })

  describe('toggleSidebar', () => {
    it('should toggle sidebar state', () => {
      const { result } = renderHook(() => useSettingsStore())

      expect(result.current.sidebarCollapsed).toBe(false)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.sidebarCollapsed).toBe(true)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.sidebarCollapsed).toBe(false)
    })
  })

  describe('graph preferences', () => {
    it('should toggle auto layout', () => {
      const { result } = renderHook(() => useSettingsStore())

      act(() => {
        result.current.setAutoLayout(false)
      })

      expect(result.current.autoLayout).toBe(false)
    })

    it('should toggle node labels', () => {
      const { result } = renderHook(() => useSettingsStore())

      act(() => {
        result.current.setShowNodeLabels(false)
      })

      expect(result.current.showNodeLabels).toBe(false)
    })

    it('should toggle edge animation', () => {
      const { result } = renderHook(() => useSettingsStore())

      act(() => {
        result.current.setAnimateEdges(false)
      })

      expect(result.current.animateEdges).toBe(false)
    })
  })

  describe('resetSettings', () => {
    it('should reset all settings to default', () => {
      const { result } = renderHook(() => useSettingsStore())

      // Change some settings
      act(() => {
        result.current.setLLMConfig({ apiKey: 'sk-test' })
        result.current.setTheme('dark')
        result.current.toggleSidebar()
        result.current.setAutoLayout(false)
      })

      // Verify changes
      expect(result.current.llmConfig.apiKey).toBe('sk-test')
      expect(result.current.theme).toBe('dark')
      expect(result.current.sidebarCollapsed).toBe(true)

      // Reset
      act(() => {
        result.current.resetSettings()
      })

      // Verify reset
      expect(result.current.llmConfig.apiKey).toBe('')
      expect(result.current.theme).toBe('system')
      expect(result.current.sidebarCollapsed).toBe(false)
      expect(result.current.autoLayout).toBe(true)
    })
  })
})
