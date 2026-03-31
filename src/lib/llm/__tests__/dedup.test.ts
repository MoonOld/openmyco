import { describe, it, expect } from 'vitest'
import { canonicalizeTitle, dedupSkeleton } from '../dedup'
import type { KnowledgeNode, KnowledgeEdge } from '@/types'

function makeNode(overrides: Partial<KnowledgeNode> & { id: string; title: string }): KnowledgeNode {
  return {
    description: '',
    type: 'concept',
    difficulty: 3,
    expanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeEdge(source: string, target: string, type: string = 'related'): KnowledgeEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: type as KnowledgeEdge['type'],
    weight: 0.7,
  }
}

describe('canonicalizeTitle', () => {
  it('trims and lowercases', () => {
    expect(canonicalizeTitle('  React  ')).toBe('react')
  })

  it('collapses whitespace', () => {
    expect(canonicalizeTitle('machine  learning')).toBe('machine learning')
  })

  it('NFKC normalizes full-width characters', () => {
    // 全角括号 → 半角括号
    expect(canonicalizeTitle('Ｒｅａｃｔ')).toBe('react')
  })

  it('returns empty for whitespace-only string', () => {
    expect(canonicalizeTitle('   ')).toBe('')
  })
})

describe('dedupSkeleton', () => {
  const parentNodeId = 'parent-1'

  it('creates all new nodes when no duplicates exist', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton(
      [
        { title: 'Python', type: 'tool', relation: 'prerequisite' },
        { title: '深度学习', type: 'concept', relation: 'postrequisite' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(2)
    expect(result.newEdges).toHaveLength(2)
    expect(result.duplicatesFound).toBe(0)
    expect(result.nodeTitleMap.size).toBe(2)
  })

  it('reuses existing node on exact title match', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
      ['existing-1', makeNode({ id: 'existing-1', title: 'Python' })],
    ])

    const result = dedupSkeleton(
      [{ title: 'Python', type: 'tool', relation: 'prerequisite' }],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(0)
    expect(result.duplicatesFound).toBe(1)
    expect(result.nodeTitleMap.get(canonicalizeTitle('Python'))).toBe('existing-1')
  })

  it('reuses existing node on case-insensitive match', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '前端框架' })],
      ['existing-1', makeNode({ id: 'existing-1', title: 'React' })],
    ])

    const result = dedupSkeleton(
      [{ title: 'react', type: 'tool', relation: 'related' }],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(0)
    expect(result.duplicatesFound).toBe(1)
  })

  it('reuses existing node with NFKC + whitespace normalization', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
      ['existing-1', makeNode({ id: 'existing-1', title: 'Machine Learning' })],
    ])

    const result = dedupSkeleton(
      [{ title: 'machine  learning', type: 'concept', relation: 'related' }],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(0)
    expect(result.duplicatesFound).toBe(1)
  })

  it('handles partial duplicates (mixed new and existing)', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
      ['existing-1', makeNode({ id: 'existing-1', title: 'Python' })],
    ])

    const result = dedupSkeleton(
      [
        { title: 'Python', type: 'tool', relation: 'prerequisite' },
        { title: '深度学习', type: 'concept', relation: 'postrequisite' },
        { title: '统计学', type: 'theory', relation: 'related' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(2)
    expect(result.duplicatesFound).toBe(1)
    // Python maps to existing-1, others are new
    expect(result.nodeTitleMap.get(canonicalizeTitle('Python'))).toBe('existing-1')
  })

  it('creates edges pointing to existing node IDs', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
      ['existing-1', makeNode({ id: 'existing-1', title: 'Python' })],
    ])

    const result = dedupSkeleton(
      [{ title: 'Python', type: 'tool', relation: 'prerequisite' }],
      parentNodeId,
      existingNodes,
      []
    )

    // prerequisite: source=Python, target=parent
    expect(result.newEdges).toHaveLength(1)
    expect(result.newEdges[0]!.source).toBe('existing-1')
    expect(result.newEdges[0]!.target).toBe('parent-1')
  })

  it('creates edges pointing to new node IDs', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton(
      [{ title: 'Python', type: 'tool', relation: 'postrequisite' }],
      parentNodeId,
      existingNodes,
      []
    )

    // postrequisite: source=parent, target=Python
    expect(result.newEdges).toHaveLength(1)
    expect(result.newEdges[0]!.source).toBe('parent-1')
    expect(result.newEdges[0]!.target).toBe(result.newNodes[0]!.id)
  })

  it('creates all new nodes when existingNodes is empty', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton(
      [
        { title: 'Python', type: 'tool', relation: 'related' },
        { title: '深度学习', type: 'concept', relation: 'related' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(2)
    expect(result.duplicatesFound).toBe(0)
  })

  it('skips parent node title to prevent self-loop', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton(
      [
        { title: '机器学习', type: 'concept', relation: 'related' },
        { title: 'Python', type: 'tool', relation: 'prerequisite' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    // 机器学习 should be skipped (self-loop prevention)
    expect(result.newNodes).toHaveLength(1)
    expect(result.newNodes[0]!.title).toBe('Python')
  })

  it('deduplicates internal repeated titles in skeleton', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton(
      [
        { title: 'Python', type: 'tool', relation: 'prerequisite' },
        { title: 'Python', type: 'tool', relation: 'related' },  // duplicate
        { title: '深度学习', type: 'concept', relation: 'postrequisite' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(2)
    expect(result.newEdges).toHaveLength(2)
  })

  it('does not create duplicate edges (same source+target:type)', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
      ['existing-1', makeNode({ id: 'existing-1', title: 'Python' })],
    ])

    const existingEdges = [makeEdge('existing-1', 'parent-1', 'prerequisite')]

    const result = dedupSkeleton(
      [{ title: 'Python', type: 'tool', relation: 'prerequisite' }],
      parentNodeId,
      existingNodes,
      existingEdges
    )

    // Edge already exists, should not create another
    expect(result.newEdges).toHaveLength(0)
  })

  it('filters out empty titles', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton(
      [
        { title: '', type: 'concept', relation: 'related' },
        { title: '   ', type: 'concept', relation: 'related' },
        { title: 'Python', type: 'tool', relation: 'prerequisite' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    expect(result.newNodes).toHaveLength(1)
    expect(result.newNodes[0]!.title).toBe('Python')
  })

  it('handles empty relatedTitles input', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton([], parentNodeId, existingNodes, [])

    expect(result.newNodes).toHaveLength(0)
    expect(result.newEdges).toHaveLength(0)
    expect(result.duplicatesFound).toBe(0)
    expect(result.nodeTitleMap.size).toBe(0)
  })

  it('handles parentNodeId not in existingNodes gracefully', () => {
    const existingNodes = new Map<string, KnowledgeNode>()

    const result = dedupSkeleton(
      [{ title: 'Python', type: 'tool', relation: 'related' }],
      'nonexistent-parent',
      existingNodes,
      []
    )

    // Should still create the node (parent self-loop check skipped since parent not found)
    expect(result.newNodes).toHaveLength(1)
    expect(result.newNodes[0]!.title).toBe('Python')
  })

  it('maps both new and reused nodes in nodeTitleMap', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
      ['existing-1', makeNode({ id: 'existing-1', title: 'Python' })],
    ])

    const result = dedupSkeleton(
      [
        { title: 'Python', type: 'tool', relation: 'prerequisite' },
        { title: '深度学习', type: 'concept', relation: 'postrequisite' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    // Both should be in the map
    expect(result.nodeTitleMap.get(canonicalizeTitle('Python'))).toBe('existing-1')
    expect(result.nodeTitleMap.get(canonicalizeTitle('深度学习'))).toBeDefined()
    expect(result.nodeTitleMap.get(canonicalizeTitle('深度学习'))).not.toBe('existing-1')
  })

  it('skips self-referencing edge (parent title in skeleton)', () => {
    const existingNodes = new Map<string, KnowledgeNode>([
      ['parent-1', makeNode({ id: 'parent-1', title: '机器学习' })],
    ])

    const result = dedupSkeleton(
      [
        { title: '机器学习', type: 'concept', relation: 'related' },
        { title: 'Python', type: 'tool', relation: 'prerequisite' },
      ],
      parentNodeId,
      existingNodes,
      []
    )

    // 机器学习 should be skipped, only Python created
    expect(result.newNodes).toHaveLength(1)
    expect(result.newNodes[0]!.title).toBe('Python')
  })
})
