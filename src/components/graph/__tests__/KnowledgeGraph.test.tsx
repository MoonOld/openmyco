/**
 * KnowledgeGraph 组件测试
 *
 * 重点测试：
 * 1. 结构签名计算
 * 2. 事件处理逻辑
 * 3. 基本渲染
 *
 * 注意：由于 ReactFlow 和 dagre 的 mock 复杂度较高，
 * 这里只测试核心逻辑，不进行完整的组件渲染测试。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeStructureSignature, dispatchGraphUpdateEvent } from '@/types/events'

describe('KnowledgeGraph - 核心逻辑测试', () => {
  describe('结构签名计算', () => {
    it('相同的节点和边应该产生相同的签名', () => {
      const nodeIds = ['node-1', 'node-2', 'node-3']
      const edges = [
        { source: 'node-1', target: 'node-2', type: 'related' },
        { source: 'node-2', target: 'node-3', type: 'prerequisite' },
      ]

      const sig1 = computeStructureSignature(nodeIds, edges)
      const sig2 = computeStructureSignature([...nodeIds].reverse(), [...edges].reverse())

      expect(sig1).toBe(sig2)
    })

    it('节点数量变化应该产生不同的签名', () => {
      const sig1 = computeStructureSignature(['node-1', 'node-2'], [])
      const sig2 = computeStructureSignature(['node-1', 'node-2', 'node-3'], [])

      expect(sig1).not.toBe(sig2)
    })

    it('边变化应该产生不同的签名', () => {
      const nodeIds = ['node-1', 'node-2']
      const sig1 = computeStructureSignature(nodeIds, [{ source: 'node-1', target: 'node-2', type: 'related' }])
      const sig2 = computeStructureSignature(nodeIds, [])

      expect(sig1).not.toBe(sig2)
    })

    it('边类型变化应该产生不同的签名', () => {
      const nodeIds = ['node-1', 'node-2']
      const sig1 = computeStructureSignature(nodeIds, [{ source: 'node-1', target: 'node-2', type: 'related' }])
      const sig2 = computeStructureSignature(nodeIds, [{ source: 'node-1', target: 'node-2', type: 'prerequisite' }])

      expect(sig1).not.toBe(sig2)
    })

    it('空图谱应该有特定的签名格式', () => {
      const sig = computeStructureSignature([], [])
      expect(sig).toBe('nodes:[]|edges:[]')
    })

    it('单个节点应该有正确的签名', () => {
      const sig = computeStructureSignature(['node-1'], [])
      expect(sig).toContain('node-1')
      expect(sig).toContain('nodes:')
      expect(sig).toContain('edges:[]')
    })
  })

  describe('事件系统', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('structure 事件应该被正确构造', () => {
      const handler = vi.fn()
      window.addEventListener('graph-updated', handler as EventListener)

      dispatchGraphUpdateEvent({
        graphId: 'test-graph',
        mutationType: 'structure',
        hasNewNodes: true,
        hasNewEdges: true,
        sourceOperationId: 'op-123',
        timestamp: Date.now(),
      })

      expect(handler).toHaveBeenCalled()
      const detail = (handler.mock.calls[0][0] as CustomEvent).detail
      expect(detail.graphId).toBe('test-graph')
      expect(detail.mutationType).toBe('structure')
      expect(detail.hasNewNodes).toBe(true)
      expect(detail.hasNewEdges).toBe(true)
      expect(detail.sourceOperationId).toBe('op-123')

      window.removeEventListener('graph-updated', handler as EventListener)
    })

    it('content 事件应该被正确构造', () => {
      const handler = vi.fn()
      window.addEventListener('graph-updated', handler as EventListener)

      dispatchGraphUpdateEvent({
        graphId: 'test-graph',
        mutationType: 'content',
        timestamp: Date.now(),
      })

      expect(handler).toHaveBeenCalled()
      const detail = (handler.mock.calls[0][0] as CustomEvent).detail
      expect(detail.mutationType).toBe('content')
      expect(detail.hasNewNodes).toBeFalsy()
      expect(detail.hasNewEdges).toBeFalsy()

      window.removeEventListener('graph-updated', handler as EventListener)
    })

    it('meta 事件应该被正确构造', () => {
      const handler = vi.fn()
      window.addEventListener('graph-updated', handler as EventListener)

      dispatchGraphUpdateEvent({
        graphId: 'test-graph',
        mutationType: 'meta',
        timestamp: Date.now(),
      })

      expect(handler).toHaveBeenCalled()
      const detail = (handler.mock.calls[0][0] as CustomEvent).detail
      expect(detail.mutationType).toBe('meta')

      window.removeEventListener('graph-updated', handler as EventListener)
    })

    it('事件应该包含时间戳', () => {
      const handler = vi.fn()
      window.addEventListener('graph-updated', handler as EventListener)

      const beforeTime = Date.now()
      dispatchGraphUpdateEvent({
        graphId: 'test-graph',
        mutationType: 'structure',
        timestamp: Date.now(),
      })

      const detail = (handler.mock.calls[0][0] as CustomEvent).detail
      expect(detail.timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(detail.timestamp).toBeLessThanOrEqual(Date.now())

      window.removeEventListener('graph-updated', handler as EventListener)
    })
  })

  describe('布局触发逻辑（理论验证）', () => {
    it('structure 变化应该触发重新布局（签名不同）', () => {
      // 初始签名
      const sig1 = computeStructureSignature(['node-1'], [])

      // 添加新节点后的签名
      const sig2 = computeStructureSignature(['node-1', 'node-2'], [
        { source: 'node-1', target: 'node-2', type: 'related' }
      ])

      // 签名不同 → 需要重新布局
      expect(sig1).not.toBe(sig2)
    })

    it('content 变化不应该触发重新布局（签名相同）', () => {
      // 初始签名
      const sig1 = computeStructureSignature(['node-1'], [])

      // 更新节点描述后的签名（节点和边不变）
      const sig2 = computeStructureSignature(['node-1'], [])

      // 签名相同 → 不需要重新布局
      expect(sig1).toBe(sig2)
    })

    it('meta 变化不应该触发重新布局（签名相同）', () => {
      // 初始签名
      const sig1 = computeStructureSignature(['node-1'], [])

      // 更新节点状态后的签名（节点和边不变）
      const sig2 = computeStructureSignature(['node-1'], [])

      // 签名相同 → 不需要重新布局
      expect(sig1).toBe(sig2)
    })
  })
})
