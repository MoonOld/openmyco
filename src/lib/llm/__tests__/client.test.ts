import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMClient } from '../client'
import type { LLMConfig } from '@/types'

// Mock fetch globally
const mockFetch = vi.fn()
// @ts-expect-error - vitest handles this
global.fetch = mockFetch

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('LLMClient', () => {
  let config: LLMConfig

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    localStorageMock.clear()

    config = {
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'test-api-key',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 4000,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('testConnection', () => {
    it('should return success when API is accessible', async () => {
      // 第一个 mock 用于端点探测 - chat/completions 成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'OK' } }] }),
      } as Response)

      // 第二个 mock 用于实际测试请求
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
      } as Response)

      const client = new LLMClient(config)
      const result = await client.testConnection()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.model).toBe('gpt-4o-mini')
        expect(result).toHaveProperty('responseTime')
        expect(result.content).toBe('OK')
      }
    })

  describe('Endpoint Caching', () => {
    const cacheKey = 'llm_endpoint:https://api.openai.com/v1:gpt-4o-mini'

    it('should restore cached endpoint from localStorage on construction', () => {
      // 预设缓存
      localStorageMock.setItem(cacheKey, 'chat/completions')

      const client = new LLMClient(config)

      expect(client.getWorkingEndpoint()).toBe('chat/completions')
    })

    it('should not restore invalid cached endpoint', () => {
      // 预设无效缓存
      localStorageMock.setItem(cacheKey, 'invalid/endpoint')

      const client = new LLMClient(config)

      expect(client.getWorkingEndpoint()).toBeNull()
    })

    it('should cache endpoint after successful detection', async () => {
      // 端点探测成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ choices: [] }),
      } as Response)

      // 实际请求
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'test' } }] }),
      } as Response)

      const client = new LLMClient(config)
      await client.testConnection()

      expect(localStorageMock.setItem).toHaveBeenCalledWith(cacheKey, 'chat/completions')
    })

    it('should prefer user-specified endpoint over cache', () => {
      // 预设缓存
      localStorageMock.setItem(cacheKey, 'chat/completions')

      const configWithEndpoint = { ...config, endpoint: 'chat/responses' }
      const client = new LLMClient(configWithEndpoint)

      expect(client.getWorkingEndpoint()).toBe('chat/responses')
    })

    it('should clear endpoint cache when baseURL changes', () => {
      // 预设缓存
      localStorageMock.setItem(cacheKey, 'chat/completions')

      const client = new LLMClient(config)
      expect(client.getWorkingEndpoint()).toBe('chat/completions')

      // 更新 baseURL
      client.updateConfig({ baseURL: 'https://api.another.com/v1' })

      // 缓存应该被清除
      expect(client.getWorkingEndpoint()).toBeNull()
    })

    it('should clear endpoint cache when model changes', () => {
      // 预设缓存
      localStorageMock.setItem(cacheKey, 'chat/completions')

      const client = new LLMClient(config)
      expect(client.getWorkingEndpoint()).toBe('chat/completions')

      // 更新 model
      client.updateConfig({ model: 'gpt-4o' })

      // 缓存应该被清除
      expect(client.getWorkingEndpoint()).toBeNull()
    })

    it('should restore cached endpoint for new config after update', () => {
      // 预设两个配置的缓存
      localStorageMock.setItem(cacheKey, 'chat/completions')
      localStorageMock.setItem(
        'llm_endpoint:https://api.another.com/v1:gpt-4o',
        'chat/responses'
      )

      const client = new LLMClient(config)
      expect(client.getWorkingEndpoint()).toBe('chat/completions')

      // 更新到新配置（有缓存）
      client.updateConfig({
        baseURL: 'https://api.another.com/v1',
        model: 'gpt-4o'
      })

      // 应该恢复新配置的缓存
      expect(client.getWorkingEndpoint()).toBe('chat/responses')
    })
  })

    it('should return detailed error when API returns 401 Unauthorized', async () => {
      // 模拟两个端点都返回 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      } as Response)

      const client = new LLMClient(config)
      const result = await client.testConnection()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('HTTP 401')
        expect(result.httpStatus).toBe(401)
        expect(result.responseBody).toBe('Invalid API key')
      }
    })

    it('should return detailed error when API returns 403 Forbidden', async () => {
      // 模拟两个端点都返回 403
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Insufficient quota',
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Insufficient quota',
      } as Response)

      const client = new LLMClient(config)
      const result = await client.testConnection()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('HTTP 403')
        expect(result.error).toContain('账户余额不足/配额用完')
        expect(result.httpStatus).toBe(403)
      }
    })

    it('should return error with CORS flag when CORS error occurs', async () => {
      // 模拟两个端点都发生 CORS 错误
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'))
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'))

      const client = new LLMClient(config)
      const result = await client.testConnection()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('CORS 跨域错误')
        expect(result.isCors).toBe(true)
      }
    })

    it('should return detailed error when API returns 404 Not Found', async () => {
      // 模拟两个端点都返回 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not Found',
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Not Found',
      } as Response)

      const client = new LLMClient(config)
      const result = await client.testConnection()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('HTTP 404')
        expect(result.error).toContain('API 端点不存在')
      }
    })

    it('should return error with hint when API returns 429 Rate Limited', async () => {
      // 模拟两个端点都返回 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      } as Response)

      const client = new LLMClient(config)
      const result = await client.testConnection()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('HTTP 429')
        expect(result.error).toContain('请求频率超限')
      }
    })

    it('should return error with hint when API returns 500 Server Error', async () => {
      // 模拟两个端点都返回 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      } as Response)

      const client = new LLMClient(config)
      const result = await client.testConnection()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('HTTP 500')
        expect(result.error).toContain('服务器内部错误')
      }
    })
  })

  describe('updateConfig', () => {
    it('should update the client configuration', () => {
      const client = new LLMClient(config)

      client.updateConfig({ model: 'gpt-4o' })

      // Verify the config was updated
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
      } as Response)

      client.testConnection()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4o"'),
        })
      )
    })
  })
})
