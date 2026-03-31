/**
 * operationService - deepenOnly Promise.allSettled 部分成功测试
 *
 * 测试重点：
 * 1. deepInfo 成功 + relatedInfo 失败 → root success（部分成功）
 * 2. deepInfo 失败 + relatedInfo 成功 → root success（部分成功，无 deep 内容）
 * 3. 两个都失败 → 全部 failed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import { useOperationStore } from '@/stores/operationStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { KnowledgeGraph, KnowledgeNode } from '@/types'

// 使用 vi.hoisted 创建可配置的 mock 函数
const { mockExpandSkeleton, mockGetKnowledgeDeep, mockGetRelatedKnowledge } = vi.hoisted(() => ({
  mockExpandSkeleton: vi.fn(),
  mockGetKnowledgeDeep: vi.fn(),
  mockGetRelatedKnowledge: vi.fn(),
}))

vi.mock('@/lib/llm', () => ({
  createLLMClient: vi.fn().mockReturnValue({
    expandSkeleton: mockExpandSkeleton,
    getKnowledgeDeep: mockGetKnowledgeDeep,
    getRelatedKnowledge: mockGetRelatedKnowledge,
  }),
}))

vi.mock('@/lib/llm/dedup', () => ({
  dedupSkeleton: vi.fn().mockReturnValue({
    newNodes: [],
    newEdges: [],
    nodeTitleMap: new Map(),
    duplicatesFound: 0,
  }),
  canonicalizeTitle: vi.fn((t: string) => t?.toLowerCase()),
}))

// Helper to create mock node
function createMockNode(id: string, title: string, overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    title,
    description: '测试描述',
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

describe('operationService - deepenOnly Promise.allSettled 部分成功', () => {
  let updateGraphByIdSpy: ReturnType<typeof vi.fn>
  let origUpdate: typeof useKnowledgeStore.getState extends () => { updateGraphById: infer T } ? T : never

  beforeEach(async () => {
    vi.clearAllMocks()

    // 设置 store 状态：节点已有描述（deepenOnly 的前置条件）
    const node1 = createMockNode('node-1', '测试节点', { expanded: false, description: '基础描述' })
    const graph = createMockGraph('graph-1', '测试图谱', [node1])
    useKnowledgeStore.setState({
      currentGraph: graph,
      selectedNodeId: null,
      expandedNodeIds: new Set(),
      deepenedNodeIds: new Set(),
      loadingNodes: new Set(),
      loadingDeepenNodes: new Set(),
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
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useKnowledgeStore.setState({ updateGraphById: origUpdate } as any)
  })

  it('deepInfo 成功 + relatedInfo 失败 → root deepenStatus=success, 有描述', async () => {
    mockGetKnowledgeDeep.mockResolvedValue({
      description: '深度描述',
      estimatedTime: 30,
    })
    mockGetRelatedKnowledge.mockRejectedValue(new Error('关联 API 失败'))

    const { deepenOnly } = await import('../operationService')
    const result = await deepenOnly('node-1')

    expect(result.success).toBe(true)

    // 找到最终的 content 写入调用
    const contentCall = findCallByMutationType(updateGraphByIdSpy, 'content')
    expect(contentCall).toBeDefined()

    // root 节点 deepenStatus 为 success，且有描述
    expect(contentCall!.rootNodeUpdates.deepenStatus).toBe('success')
    expect(contentCall!.rootNodeUpdates.description).toBe('深度描述')

    // relatedInfo 失败，没有 nodeUpdates
    expect(contentCall!.nodeUpdates).toHaveLength(0)
  })

  it('deepInfo 失败 + relatedInfo 成功 → root deepenStatus=success（仅 partial）', async () => {
    mockGetKnowledgeDeep.mockRejectedValue(new Error('深度 API 失败'))
    mockGetRelatedKnowledge.mockResolvedValue([
      { title: '子节点A', description: '子节点描述', difficulty: 3, type: 'concept' },
    ])

    const { deepenOnly } = await import('../operationService')
    const result = await deepenOnly('node-1')

    // deepenOnly 使用 Promise.allSettled，一个成功就够了
    expect(result.success).toBe(true)

    // 找到最终的 content 写入调用
    const contentCall = findCallByMutationType(updateGraphByIdSpy, 'content')
    expect(contentCall).toBeDefined()

    // root 节点 deepenStatus 为 success
    expect(contentCall!.rootNodeUpdates.deepenStatus).toBe('success')

    // relatedInfo 成功但子节点不在图中（因为图中只有 node-1），所以 nodeUpdates 为空
    // （findNodeIdByCanonicalTitle 找不到匹配的节点）
  })

  it('两个都失败 → deepenOnly failed', async () => {
    mockGetKnowledgeDeep.mockRejectedValue(new Error('深度 API 失败'))
    mockGetRelatedKnowledge.mockRejectedValue(new Error('关联 API 失败'))

    const { deepenOnly } = await import('../operationService')
    const result = await deepenOnly('node-1')

    expect(result.success).toBe(false)

    // 找到 meta 写入调用（catch 块中的失败写入）
    const metaCall = findCallByMutationType(updateGraphByIdSpy, 'meta')
    expect(metaCall).toBeDefined()

    // root 节点 deepenStatus 为 failed
    expect(metaCall!.rootNodeUpdates.deepenStatus).toBe('failed')
  })
})
