/**
 * operationService - Promise.allSettled 部分成功测试
 *
 * 测试重点：
 * 1. deepInfo 成功 + relatedInfo 失败 → root success，骨架 failed
 * 2. deepInfo 失败 + relatedInfo 成功 → 骨架 success，root 无描述
 * 3. 两个都失败 → 全部 failed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import { useOperationStore } from '@/stores/operationStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { KnowledgeGraph, KnowledgeNode } from '@/types'

// 使用 vi.hoisted 创建可配置的 mock 函数
const { mockGetKnowledgeSkeleton, mockGetKnowledgeDeep, mockGetRelatedKnowledge } = vi.hoisted(() => ({
  mockGetKnowledgeSkeleton: vi.fn(),
  mockGetKnowledgeDeep: vi.fn(),
  mockGetRelatedKnowledge: vi.fn(),
}))

vi.mock('@/lib/llm', () => ({
  createLLMClient: vi.fn().mockReturnValue({
    getKnowledgeSkeleton: mockGetKnowledgeSkeleton,
    getKnowledgeDeep: mockGetKnowledgeDeep,
    getRelatedKnowledge: mockGetRelatedKnowledge,
  }),
}))

// Helper to create mock node
function createMockNode(id: string, title: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    title,
    description: '',
    type: 'concept',
    expanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// Helper to create mock graph
function createMockGraph(id: string, name: string, nodes: KnowledgeNode[] = []): KnowledgeGraph {
  const nodeMap = new Map<string, KnowledgeNode>()
  nodes.forEach(n => nodeMap.set(n.id, n))
  return {
    id,
    name,
    rootId: nodes[0]?.id || '',
    nodes: nodeMap,
    edges: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Helper to find the last mock call by mutationType
const findCallByMutationType = (
  spy: ReturnType<typeof vi.fn>,
  mutationType: string
): { rootNodeUpdates: Record<string, unknown>; nodeUpdates?: Array<{ updates: Record<string, unknown> }> } | undefined => {
  // Iterate in reverse to find the last matching call
  for (let i = spy.mock.calls.length - 1; i >= 0; i--) {
    const arg = spy.mock.calls[i]![1] as Record<string, unknown>
    if (arg?.mutationType === mutationType) {
      return {
        rootNodeUpdates: arg.rootNodeUpdates as Record<string, unknown>,
        nodeUpdates: arg.nodeUpdates as Array<{ updates: Record<string, unknown> }> | undefined,
      }
    }
  }
  return undefined
}

describe('operationService - Promise.allSettled 部分成功', () => {
  let updateGraphByIdSpy: ReturnType<typeof vi.fn>
  let origUpdate: typeof useKnowledgeStore.getState extends () => { updateGraphById: infer T } ? T : never

  beforeEach(async () => {
    vi.clearAllMocks()

    // 设置 store 状态
    const node1 = createMockNode('node-1', '测试节点', { expanded: false })
    const graph = createMockGraph('graph-1', '测试图谱', [node1])
    useKnowledgeStore.setState({
      currentGraph: graph,
      selectedNodeId: null,
      expandedNodeIds: new Set(),
      loadingNodes: new Set(),
    })
    useOperationStore.setState({ operations: new Map() })
    useSettingsStore.setState({
      llmConfig: {
        apiKey: 'test-key',
        baseURL: 'https://test.com',
        model: 'test-model',
      },
    })

    // 设置 updateGraphById spy
    updateGraphByIdSpy = vi.fn().mockResolvedValue({ success: true })
    origUpdate = useKnowledgeStore.getState().updateGraphById
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useKnowledgeStore.setState({ updateGraphById: updateGraphByIdSpy } as any)

    // 默认 skeleton mock（每个测试可覆盖）
    mockGetKnowledgeSkeleton.mockResolvedValue({
      node: { title: '测试', briefDescription: '简介' },
      relatedTitles: [
        { title: '子节点A', type: 'concept', relation: 'related' },
      ],
    })
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useKnowledgeStore.setState({ updateGraphById: origUpdate } as any)
  })

  it('deepInfo 成功 + relatedInfo 失败 → root success, 骨架节点 failed', async () => {
    mockGetKnowledgeDeep.mockResolvedValue({
      description: '深度描述',
      estimatedTime: 30,
    })
    mockGetRelatedKnowledge.mockRejectedValue(new Error('关联 API 失败'))

    const { expandNode } = await import('../operationService')
    const result = await expandNode('node-1')

    expect(result.success).toBe(true)

    // 找到最终的 content 写入调用
    const contentCall = findCallByMutationType(updateGraphByIdSpy, 'content')
    expect(contentCall).toBeDefined()

    // root 节点状态为 success
    expect(contentCall!.rootNodeUpdates.operationStatus).toBe('success')
    expect(contentCall!.rootNodeUpdates.description).toBe('深度描述')

    // 骨架节点标记为 failed
    expect(contentCall!.nodeUpdates).toHaveLength(1)
    expect(contentCall!.nodeUpdates![0].updates.operationStatus).toBe('failed')
  })

  it('deepInfo 失败 + relatedInfo 成功 → 骨架节点 success, root 无描述但 success', async () => {
    mockGetKnowledgeDeep.mockRejectedValue(new Error('深度 API 失败'))
    mockGetRelatedKnowledge.mockResolvedValue([
      { title: '子节点A', description: '子节点描述', difficulty: 3, type: 'concept' },
    ])

    const { expandNode } = await import('../operationService')
    const result = await expandNode('node-1')

    expect(result.success).toBe(true)

    // 找到最终的 content 写入调用
    const contentCall = findCallByMutationType(updateGraphByIdSpy, 'content')
    expect(contentCall).toBeDefined()

    // root 节点状态为 success（无 description）
    expect(contentCall!.rootNodeUpdates.operationStatus).toBe('success')
    expect(contentCall!.rootNodeUpdates.description).toBeUndefined()

    // 骨架节点有内容且 success
    expect(contentCall!.nodeUpdates).toHaveLength(1)
    expect(contentCall!.nodeUpdates![0].updates.operationStatus).toBe('success')
    expect(contentCall!.nodeUpdates![0].updates.description).toBe('子节点描述')
  })

  it('两个都失败 → 全部 failed', async () => {
    mockGetKnowledgeDeep.mockRejectedValue(new Error('深度 API 失败'))
    mockGetRelatedKnowledge.mockRejectedValue(new Error('关联 API 失败'))

    const { expandNode } = await import('../operationService')
    const result = await expandNode('node-1')

    expect(result.success).toBe(false)

    // 找到 meta 写入调用（catch 块中的失败写入）
    const metaCall = findCallByMutationType(updateGraphByIdSpy, 'meta')
    expect(metaCall).toBeDefined()

    // root 节点 failed
    expect(metaCall!.rootNodeUpdates.operationStatus).toBe('failed')

    // 骨架节点也 failed
    expect(metaCall!.nodeUpdates).toHaveLength(1)
    expect(metaCall!.nodeUpdates![0].updates.operationStatus).toBe('failed')
  })
})
