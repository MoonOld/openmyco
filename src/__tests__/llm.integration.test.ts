/**
 * LLM 集成测试
 *
 * 测试所有 LLM 交互逻辑，需要真实的 API Key
 *
 * 运行方式：
 *   OPENAI_API_KEY=$OPENAI_API_KEY \
 *   OPENAI_BASE_URL=$OPENAI_BASE_URL \
 *   OPENAI_MODEL=gpt-4o-mini \
 *   npm run test:llm
 *
 * 或者创建 .env.local 文件：
 *   OPENAI_API_KEY=sk-xxx
 *   OPENAI_BASE_URL=https://api.openai.com/v1
 *   OPENAI_MODEL=gpt-4o-mini
 */

import { describe, it, beforeAll } from 'vitest'
import { LLMClient, createLLMClient } from '@/lib/llm'
import type { LLMConfig } from '@/types'

// 测试配置
const TEST_CONFIG: LLMConfig = {
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4000,
  maxConcurrency: 1,  // 单线程避免速率限制
}

// 检查是否配置了 API Key
const hasApiKey = !!TEST_CONFIG.apiKey

// 测试用的主题
const TEST_TOPIC = '递归'
const TEST_TOPIC_COMPLEX = 'React Hooks'

describe.skipIf(!hasApiKey)('LLM 集成测试', () => {
  let client: LLMClient

  beforeAll(() => {
    client = createLLMClient(TEST_CONFIG)
    console.log('\n🧪 LLM 集成测试配置:')
    console.log(`   Base URL: ${TEST_CONFIG.baseURL}`)
    console.log(`   Model: ${TEST_CONFIG.model}`)
    console.log(`   Max Concurrency: ${TEST_CONFIG.maxConcurrency}`)
    console.log('')
  })

  // ==================== 连接测试 ====================
  describe('连接测试', () => {
    it('应该能成功连接 API', { timeout: 30000 }, async () => {
      const result = await client.testConnection()
      if (!result.success) {
        console.log(`   ❌ 连接失败: ${result.error}`)
        return
      }
      console.log(`   ✅ 连接成功，响应时间: ${result.responseTime}ms`)
      console.log(`   📝 模型回复: "${result.content?.slice(0, 50)}..."`)
    })
  })

  // ==================== 一次性生成测试 ====================
  describe('generateKnowledgeGraphV2 - 一次性生成', () => {
    it('应该能生成知识图谱', { timeout: 60000 }, async () => {
      const start = performance.now()
      const response = await client.generateKnowledgeGraphV2(TEST_TOPIC)
      const duration = performance.now() - start

      console.log(`   ⏱️ 耗时: ${duration.toFixed(0)}ms`)

      if (response) {
        console.log(`   📊 节点数: ${response.nodes.length}`)
        console.log(`   🔗 边数: ${response.edges.length}`)

        const rootNode = response.nodes.find(n => n.ref === 'root')
        if (rootNode) {
          console.log(`   🎯 根节点: ${rootNode.title}`)
          console.log(`   📝 描述: ${rootNode.description?.slice(0, 100)}...`)
        }
      }
    })

    it('应该能处理复杂主题', { timeout: 90000 }, async () => {
      const response = await client.generateKnowledgeGraphV2(TEST_TOPIC_COMPLEX)

      if (response) {
        console.log(`   📊 ${TEST_TOPIC_COMPLEX} 节点数: ${response.nodes.length}`)
        const types = new Set(response.nodes.map(n => n.type))
        console.log(`   🏷️ 节点类型: ${Array.from(types).join(', ')}`)
      }
    })
  })

  // ==================== 分层获取测试 ====================
  describe('getKnowledgeSkeleton - Step 1: 获取骨架', () => {
    it('应该能快速返回知识骨架', { timeout: 30000 }, async () => {
      const start = performance.now()
      const skeleton = await client.getKnowledgeSkeleton(TEST_TOPIC)
      const duration = performance.now() - start

      console.log(`   ⏱️ 骨架耗时: ${duration.toFixed(0)}ms`)

      if (skeleton) {
        console.log(`   🎯 主节点: ${skeleton.node.title}`)
        console.log(`   📝 简介: ${skeleton.node.briefDescription?.slice(0, 80)}...`)
        console.log(`   🔗 关联知识数: ${skeleton.relatedTitles.length}`)

        if (skeleton.relatedTitles.length > 0) {
          console.log(`   📋 前3个关联: ${skeleton.relatedTitles.slice(0, 3).map(r => r.title).join(', ')}`)
        }
      }
    })
  })

  describe('getKnowledgeDeep - Step 2A: 获取深度信息', () => {
    it('应该能返回详细的知识内容', { timeout: 45000 }, async () => {
      // 先获取骨架
      const skeleton = await client.getKnowledgeSkeleton(TEST_TOPIC)
      if (!skeleton) {
        console.log('   ⚠️ 无法获取骨架，跳过深度测试')
        return
      }

      const start = performance.now()
      const deepInfo = await client.getKnowledgeDeep(
        skeleton.node.title,
        skeleton.node.briefDescription
      )
      const duration = performance.now() - start

      console.log(`   ⏱️ 深度信息耗时: ${duration.toFixed(0)}ms`)

      if (deepInfo) {
        console.log(`   📝 描述长度: ${deepInfo.description?.length || 0} 字符`)
        console.log(`   ⏰ 预计学习时间: ${deepInfo.estimatedTime || '未设置'} 分钟`)
        if (deepInfo.useCases?.length) {
          console.log(`   💡 用例数: ${deepInfo.useCases.length}`)
        }
        if (deepInfo.examples?.length) {
          console.log(`   📚 示例数: ${deepInfo.examples.length}`)
        }
      }
    })
  })

  describe('getRelatedKnowledge - Step 2B: 获取关联知识', () => {
    it('应该能批量返回关联知识描述', { timeout: 45000 }, async () => {
      // 先获取骨架
      const skeleton = await client.getKnowledgeSkeleton(TEST_TOPIC)
      if (!skeleton || skeleton.relatedTitles.length === 0) {
        console.log('   ⚠️ 无法获取骨架或无关联知识，跳过测试')
        return
      }

      const relatedTitles = skeleton.relatedTitles.slice(0, 5).map(r => r.title)

      const start = performance.now()
      const relatedInfo = await client.getRelatedKnowledge(
        skeleton.node.title,
        relatedTitles
      )
      const duration = performance.now() - start

      console.log(`   ⏱️ 关联知识耗时: ${duration.toFixed(0)}ms`)

      if (relatedInfo) {
        console.log(`   📊 返回关联数: ${relatedInfo.length}`)
        relatedInfo.slice(0, 3).forEach((info, i) => {
          console.log(`   ${i + 1}. ${info.title}: ${info.description?.slice(0, 50)}...`)
        })
      }
    })
  })

  describe('getKnowledgeLayered - 分层获取完整知识', () => {
    it('应该能分层获取完整知识图谱', { timeout: 90000 }, async () => {
      let skeletonTime = 0

      const start = performance.now()
      const response = await client.getKnowledgeLayered(TEST_TOPIC, (skeleton) => {
        skeletonTime = performance.now() - start
        console.log(`   ⚡ 骨架回调触发: ${skeletonTime.toFixed(0)}ms`)
        console.log(`   🎯 骨架节点: ${skeleton.node.title}`)
      })
      const totalDuration = performance.now() - start

      console.log(`   ⏱️ 总耗时: ${totalDuration.toFixed(0)}ms`)
      console.log(`   📊 骨架占比: ${((skeletonTime / totalDuration) * 100).toFixed(1)}%`)

      if (response) {
        console.log(`   🎯 根节点: ${response.node.title}`)
        const totalNodes = 1 + response.prerequisites.length + response.postrequisites.length + response.related.length
        console.log(`   📊 总节点数: ${totalNodes}`)
        console.log(`   🔗 总边数: ${response.relations.length}`)
      }
    })
  })

  // ==================== 并发测试 ====================
  describe('并发测试', () => {
    it('并发 3 个探索应该遵守并发限制', { timeout: 120000 }, async () => {
      const topics = ['数组', '链表', '栈']

      const start = performance.now()
      const results = await Promise.all(
        topics.map(topic => client.generateKnowledgeGraphV2(topic))
      )
      const duration = performance.now() - start

      const successCount = results.filter(r => r !== null).length
      console.log(`   ⏱️ 并发 3 个耗时: ${duration.toFixed(0)}ms`)
      console.log(`   ✅ 成功数: ${successCount}/${topics.length}`)

      results.forEach((result, i) => {
        if (result) {
          console.log(`   ${i + 1}. ${topics[i]}: ${result.nodes.length} 节点`)
        }
      })
    })
  })

  // ==================== 边界情况测试 ====================
  describe('边界情况', () => {
    it('应该能处理简短主题', { timeout: 30000 }, async () => {
      const response = await client.generateKnowledgeGraphV2('API')
      if (response) {
        console.log(`   ✅ 简短主题成功: ${response.nodes.length} 节点`)
      }
    })

    it('应该能处理中文主题', { timeout: 60000 }, async () => {
      const response = await client.generateKnowledgeGraphV2('设计模式')
      if (response) {
        console.log(`   ✅ 中文主题成功: ${response.nodes.length} 节点`)
      }
    })

    it('应该能处理英文主题', { timeout: 60000 }, async () => {
      const response = await client.generateKnowledgeGraphV2('Design Patterns')
      if (response) {
        console.log(`   ✅ 英文主题成功: ${response.nodes.length} 节点`)
      }
    })
  })
})

// 输出测试说明
if (!hasApiKey) {
  console.log(`
⚠️ 跳过 LLM 集成测试：未配置 OPENAI_API_KEY 环境变量

运行方式：
  OPENAI_API_KEY=sk-xxx \\
  OPENAI_BASE_URL=https://api.openai.com/v1 \\
  OPENAI_MODEL=gpt-4o-mini \\
  npm run test:llm

或创建 .env.local 文件：
  OPENAI_API_KEY=sk-xxx
  OPENAI_BASE_URL=https://api.openai.com/v1
  OPENAI_MODEL=gpt-4o-mini
`)
}
