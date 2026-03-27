import { describe, it, expect } from 'vitest'
import {
  cn,
  generateId,
  formatDate,
  arrayToNodes,
  buildTitleToIdMap,
  convertRelationsToIds,
} from '../utils'
import type { KnowledgeNode, RelationType } from '@/types'

describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    const shouldShow = false
    expect(cn('foo', shouldShow && 'bar', 'baz')).toBe('foo baz')
  })

  it('should handle Tailwind conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('should handle empty input', () => {
    expect(cn()).toBe('')
  })
})

describe('generateId', () => {
  it('should generate a unique ID', () => {
    const id1 = generateId()
    const id2 = generateId()

    expect(id1).not.toBe(id2)
    expect(id1).toBeTruthy()
    expect(id1.length).toBeGreaterThan(10)
  })

  it('should generate alphanumeric IDs', () => {
    const id = generateId()
    expect(id).toMatch(/^[a-z0-9]+$/)
  })
})

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-03-27T10:30:00')
    const formatted = formatDate(date)

    expect(formatted).toContain('2024')
    expect(formatted).toContain('03')
    expect(formatted).toContain('27')
  })

  it('should handle different dates', () => {
    const date1 = new Date('2024-01-15T08:00:00')
    const date2 = new Date('2024-12-31T23:59:59')

    expect(formatDate(date1)).not.toBe(formatDate(date2))
  })
})

describe('arrayToNodes', () => {
  const mockNodes: KnowledgeNode[] = [
    {
      id: '1',
      title: 'Node 1',
      description: 'Description 1',
      type: 'concept',
      expanded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      title: 'Node 2',
      description: 'Description 2',
      type: 'skill',
      expanded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  it('should convert array to Map', () => {
    const map = arrayToNodes(mockNodes)

    expect(map).toBeInstanceOf(Map)
    expect(map.size).toBe(2)
  })

  it('should use node IDs as keys', () => {
    const map = arrayToNodes(mockNodes)

    expect(map.get('1')).toBe(mockNodes[0])
    expect(map.get('2')).toBe(mockNodes[1])
  })

  it('should handle empty array', () => {
    const map = arrayToNodes([])
    expect(map.size).toBe(0)
  })
})

describe('buildTitleToIdMap', () => {
  const mockNode: KnowledgeNode = {
    id: 'root-id',
    title: 'Root',
    description: 'Root node',
    type: 'concept',
    expanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockResponse: {
    node: KnowledgeNode
    prerequisites: KnowledgeNode[]
    postrequisites: KnowledgeNode[]
    related: KnowledgeNode[]
    relations: Array<{ from: string; to: string; type: RelationType }>
  } = {
    node: mockNode,
    prerequisites: [
      {
        id: 'pre1-id',
        title: 'Prerequisite 1',
        description: 'Pre-desc 1',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    postrequisites: [
      {
        id: 'post1-id',
        title: 'Postrequisite 1',
        description: 'Post-desc 1',
        type: 'skill',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    related: [],
    relations: [],
  }

  it('should build title to ID mapping', () => {
    const map = buildTitleToIdMap(mockNode, mockResponse)

    expect(map.get('Root')).toBe('root-id')
    expect(map.get('Prerequisite 1')).toBe('pre1-id')
    expect(map.get('Postrequisite 1')).toBe('post1-id')
  })

  it('should include all node types', () => {
    const map = buildTitleToIdMap(mockNode, mockResponse)

    expect(map.size).toBe(3)
  })
})

describe('convertRelationsToIds', () => {
  const titleToId = new Map([
    ['Node A', 'id-a'],
    ['Node B', 'id-b'],
    ['Node C', 'id-c'],
  ])

  const relations = [
    { from: 'Node A', to: 'Node B', type: 'prerequisite' as RelationType },
    { from: 'Node B', to: 'Node C', type: 'related' as RelationType },
    { from: 'Node X', to: 'Node Y', type: 'related' as RelationType }, // Invalid - nodes don't exist
  ]

  it('should convert titles to IDs', () => {
    const result = convertRelationsToIds(relations, titleToId)

    expect(result).toHaveLength(2) // Only valid relations
    expect(result[0]).toEqual({
      from: 'id-a',
      to: 'id-b',
      type: 'prerequisite',
    })
  })

  it('should filter out invalid relations', () => {
    const result = convertRelationsToIds(relations, titleToId)

    expect(result.every(r => r.from && r.to)).toBe(true)
  })

  it('should preserve relation weights', () => {
    const relationsWithWeight = [
      {
        from: 'Node A',
        to: 'Node B',
        type: 'prerequisite' as RelationType,
        weight: 0.8,
      },
    ]

    const result = convertRelationsToIds(relationsWithWeight, titleToId)

    expect(result[0].weight).toBe(0.8)
  })
})
