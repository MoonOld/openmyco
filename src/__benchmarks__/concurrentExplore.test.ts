/**
 * 并发探索性能测试
 *
 * 测试场景：比较并发 vs 顺序执行 LLM API 调用的性能
 *
 * 运行方式：
 *   OPENAI_API_KEY=your-key OPENAI_BASE_URL=https://api.openai.com/v1 npm run test:perf
 */

import { describe, it, beforeAll } from 'vitest'
import { LLMClient } from '@/lib/llm/client'
import type { LLMConfig } from '@/types'

// 测试配置
const TEST_CONFIG: LLMConfig = {
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.LLM_MODEL || 'glm-4.7',
  temperature: 0.7,
  maxTokens: 4000,
}

// 检查是否配置了 API Key
const hasApiKey = !!TEST_CONFIG.apiKey

// 测试用的知识点列表
const TOPICS = [
  '数组',
  '链表',
  '栈',
  '队列',
  '树',
  '图',
  '哈希表',
  '堆',
  '排序算法',
  '查找算法',
]

describe.skipIf(!hasApiKey)('并发探索性能测试', () => {
  let client: LLMClient

  
  beforeAll(() => {
    client = new LLMClient(TEST_CONFIG)
  })

  it('单次探索 - 数据结构', { timeout: 60000 }, async () => {
    const start = performance.now()
    await client.generateKnowledgeGraphV2('数据结构')
    const duration = performance.now() - start
    console.log(`  单次探索耗时: ${duration.toFixed(0)}ms`)
  })

  it('并发 5 个探索', { timeout: 120000 }, async () => {
    const start = performance.now()
    await Promise.all(
      TOPICS.slice(0, 5).map(topic => client.generateKnowledgeGraphV2(topic))
    )
    const duration = performance.now() - start
    console.log(`  并发 5 个耗时: ${duration.toFixed(0)}ms`)
  })

  it('并发 10 个探索', { timeout: 180000 }, async () => {
    const start = performance.now()
    await Promise.all(
      TOPICS.map(topic => client.generateKnowledgeGraphV2(topic))
    )
    const duration = performance.now() - start
    console.log(`  并发 10 个耗时: ${duration.toFixed(0)}ms`)
  })

  it('顺序执行 10 个探索', { timeout: 300000 }, async () => {
    const start = performance.now()
    for (const topic of TOPICS) {
      await client.generateKnowledgeGraphV2(topic)
    }
    const duration = performance.now() - start
    console.log(`  顺序 10 个耗时: ${duration.toFixed(0)}ms`)
  })
})
