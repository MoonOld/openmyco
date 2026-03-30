import { describe, it, expect } from 'vitest'
import {
  parseKnowledgeResponse,
  validateKnowledgeResponse,
  extractErrorMessage,
  buildTitleToIdMap,
  convertRelationsToIds,
  extractJSON,
  parseDeepResponse,
} from '../parsers'
import type { RelationType, LLMKnowledgeResponse } from '@/types'

describe('parseKnowledgeResponse', () => {
  const validJSON = JSON.stringify({
    node: {
      title: 'React',
      description: 'A JavaScript library',
      type: 'tool',
      difficulty: 3,
    },
    prerequisites: [
      {
        title: 'JavaScript',
        description: 'A programming language',
        type: 'skill',
        difficulty: 2,
      },
    ],
    postrequisites: [],
    related: [],
    relations: [
      {
        from: 'React',
        to: 'JavaScript',
        type: 'prerequisite',
        weight: 0.9,
      },
    ],
  })

  it('should parse valid JSON response', () => {
    const result = parseKnowledgeResponse(validJSON, 'root-id')

    expect(result).not.toBeNull()
    expect(result?.node.title).toBe('React')
    expect(result?.node.id).toBe('root-id')
  })

  it('should extract nodes from response', () => {
    const result = parseKnowledgeResponse(validJSON, 'root-id')

    expect(result?.prerequisites).toHaveLength(1)
    expect(result?.prerequisites[0].title).toBe('JavaScript')
  })

  it('should extract relations', () => {
    const result = parseKnowledgeResponse(validJSON, 'root-id')

    expect(result?.relations).toHaveLength(1)
    expect(result?.relations[0].type).toBe('prerequisite')
  })

  it('should handle response with extra text', () => {
    const responseWithExtra = `Here's the knowledge graph:

    ${validJSON}

    Hope this helps!`

    const result = parseKnowledgeResponse(responseWithExtra, 'root-id')

    expect(result).not.toBeNull()
  })

  it('should return null for invalid JSON', () => {
    const result = parseKnowledgeResponse('not valid json', 'root-id')

    expect(result).toBeNull()
  })

  it('should handle empty arrays', () => {
    const emptyResponse = JSON.stringify({
      node: {
        title: 'Test',
        description: 'Test node',
        type: 'concept',
        difficulty: 1,
      },
      prerequisites: [],
      postrequisites: [],
      related: [],
      relations: [],
    })

    const result = parseKnowledgeResponse(emptyResponse, 'root-id')

    expect(result?.prerequisites).toHaveLength(0)
    expect(result?.postrequisites).toHaveLength(0)
    expect(result?.related).toHaveLength(0)
  })
})

describe('validateKnowledgeResponse', () => {
  const validResponse = {
    node: { title: 'Test', description: 'Test', type: 'concept', difficulty: 1 },
    prerequisites: [],
    postrequisites: [],
    related: [],
    relations: [],
  }

  it('should validate correct response structure', () => {
    expect(validateKnowledgeResponse(validResponse)).toBe(true)
  })

  it('should reject response without node', () => {
    const invalid = { ...validResponse, node: null }
    expect(validateKnowledgeResponse(invalid as unknown as LLMKnowledgeResponse)).toBe(false)
  })

  it('should reject response with non-array fields', () => {
    const invalid = { ...validResponse, prerequisites: 'not-an-array' }
    expect(validateKnowledgeResponse(invalid as unknown as LLMKnowledgeResponse)).toBe(false)
  })

  it('should reject null or undefined', () => {
    expect(validateKnowledgeResponse(null as unknown as LLMKnowledgeResponse)).toBe(false)
    expect(validateKnowledgeResponse(undefined as unknown as LLMKnowledgeResponse)).toBe(false)
  })
})

describe('extractErrorMessage', () => {
  it('should extract error from API response', () => {
    const response = 'Error: Invalid API key provided'
    const result = extractErrorMessage(response)

    expect(result).toBe('Invalid API key provided')
  })

  it('should handle "sorry" pattern', () => {
    const response = "Sorry, I can't help with that request"
    const result = extractErrorMessage(response)

    expect(result).toBeTruthy()
  })

  it('should handle Chinese error patterns', () => {
    const response = '无法完成您的请求，请重试'
    const result = extractErrorMessage(response)

    expect(result).toBeTruthy()
  })

  it('should return null for non-error messages', () => {
    const response = 'Here is your knowledge graph: {...}'
    const result = extractErrorMessage(response)

    expect(result).toBeNull()
  })
})

describe('buildTitleToIdMap', () => {
  const mockNode = {
    id: 'root',
    title: 'Root',
    description: '',
    type: 'concept' as const,
    expanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockResponse = {
    node: mockNode,
    prerequisites: [
      {
        id: 'pre1',
        title: 'Pre 1',
        description: '',
        type: 'skill' as const,
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    postrequisites: [],
    related: [],
    relations: [],
  }

  it('should map node titles to IDs', () => {
    const map = buildTitleToIdMap(mockNode, mockResponse)

    expect(map.get('Root')).toBe('root')
    expect(map.get('Pre 1')).toBe('pre1')
  })
})

describe('convertRelationsToIds', () => {
  it('should convert relation titles to IDs', () => {
    const titleToId = new Map([
      ['A', 'id-a'],
      ['B', 'id-b'],
    ])

    const relations = [
      { from: 'A', to: 'B', type: 'related' as RelationType },
    ]

    const result = convertRelationsToIds(relations, titleToId)

    expect(result).toHaveLength(1)
    expect(result[0].from).toBe('id-a')
    expect(result[0].to).toBe('id-b')
  })

  it('should filter invalid relations', () => {
    const titleToId = new Map([
      ['A', 'id-a'],
    ])

    const relations = [
      { from: 'A', to: 'B', type: 'related' as RelationType }, // B doesn't exist
      { from: 'C', to: 'A', type: 'related' as RelationType }, // C doesn't exist
    ]

    const result = convertRelationsToIds(relations, titleToId)

    expect(result).toHaveLength(0)
  })
})

describe('extractJSON', () => {
  it('should return raw content if it is already valid JSON', () => {
    const json = '{"name":"test","value":42}'
    expect(extractJSON(json)).toBe(json)
  })

  it('should extract JSON when followed by extra text', () => {
    const content = '{"name":"test"} Here is some extra text that the LLM added.'
    expect(extractJSON(content)).toBe('{"name":"test"}')
  })

  it('should strip markdown code fence and extract JSON', () => {
    const content = '```json\n{"name":"test"}\n```'
    expect(extractJSON(content)).toBe('{"name":"test"}')
  })

  it('should strip code fence without language hint', () => {
    const content = '```\n{"name":"test"}\n```'
    expect(extractJSON(content)).toBe('{"name":"test"}')
  })

  it('should not break on brackets inside JSON strings', () => {
    const content = '{"text": "a {b} c"}'
    expect(extractJSON(content)).toBe('{"text": "a {b} c"}')
  })

  it('should return null when no JSON is present', () => {
    expect(extractJSON('plain text without json')).toBeNull()
  })

  it('should extract top-level array JSON', () => {
    const content = '[1, 2, 3] trailing'
    expect(extractJSON(content)).toBe('[1, 2, 3]')
  })

  it('should find first valid JSON among multiple candidates', () => {
    const content = 'Some text {invalid { bracket} {"valid": true} extra'
    expect(extractJSON(content)).toBe('{"valid": true}')
  })

  it('should handle escaped quotes inside JSON strings', () => {
    const content = '{"msg": "He said \\"hello\\""} and more'
    expect(JSON.parse(extractJSON(content)!)).toEqual({ msg: 'He said "hello"' })
  })
})

describe('parseDeepResponse - keyTerms', () => {
  it('should parse keyTerms with valid entries', () => {
    const content = JSON.stringify({
      title: 'React Hooks',
      description: 'React Hooks let you use state in functional components.',
      principle: 'Hooks are functions that hook into React state.',
      keyTerms: [
        { term: 'useState', definition: 'A hook that adds state to functional components' },
        { term: 'useEffect', definition: 'A hook for side effects in functional components' },
      ],
      estimatedTime: 30,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.keyTerms).toHaveLength(2)
    expect(result?.keyTerms?.[0]).toEqual({
      term: 'useState',
      definition: 'A hook that adds state to functional components',
    })
    expect(result?.keyTerms?.[1]).toEqual({
      term: 'useEffect',
      definition: 'A hook for side effects in functional components',
    })
  })

  it('should filter out keyTerms entries with empty term or definition', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      keyTerms: [
        { term: 'valid', definition: 'valid def' },
        { term: '', definition: 'empty term' },
        { term: 'empty def', definition: '' },
        { term: '  ', definition: 'whitespace term' },
      ],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.keyTerms).toHaveLength(1)
    expect(result?.keyTerms?.[0]?.term).toBe('valid')
  })

  it('should return undefined keyTerms when not present in response', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      principle: 'Some principle',
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.keyTerms).toBeUndefined()
  })

  it('should return undefined keyTerms when keyTerms is empty array after filtering', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      keyTerms: [
        { term: '', definition: '' },
      ],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.keyTerms).toBeUndefined()
  })

  it('should handle keyTerms being a non-array value gracefully', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      keyTerms: 'not an array',
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.keyTerms).toBeUndefined()
  })

  it('should handle keyTerms with non-object entries', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      keyTerms: ['string entry', 123, null, { term: 'valid', definition: 'valid def' }],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.keyTerms).toHaveLength(1)
    expect(result?.keyTerms?.[0]?.term).toBe('valid')
  })

  it('should trim whitespace from term and definition', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      keyTerms: [
        { term: '  useState  ', definition: '  adds state  ' },
      ],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.keyTerms?.[0]).toEqual({
      term: 'useState',
      definition: 'adds state',
    })
  })
})

describe('parseDeepResponse - subTopics', () => {
  it('should parse subTopics with valid entries', () => {
    const content = JSON.stringify({
      title: 'React Hooks',
      description: 'React Hooks let you use state in functional components.',
      principle: 'Hooks are functions that hook into React state.',
      subTopics: [
        { title: 'State Hooks', description: 'Manage component state', keyPoints: ['useState', 'useReducer'] },
        { title: 'Effect Hooks', description: 'Handle side effects', keyPoints: ['useEffect', 'useLayoutEffect'] },
        { title: 'Context Hooks', description: 'Share data across tree' },
      ],
      estimatedTime: 30,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics).toHaveLength(3)
    expect(result?.subTopics?.[0]).toEqual({
      title: 'State Hooks',
      description: 'Manage component state',
      keyPoints: ['useState', 'useReducer'],
    })
    expect(result?.subTopics?.[2]).toEqual({
      title: 'Context Hooks',
      description: 'Share data across tree',
    })
  })

  it('should filter out subTopics entries with empty title or description', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      subTopics: [
        { title: 'valid', description: 'valid desc' },
        { title: '', description: 'empty title' },
        { title: 'empty desc', description: '' },
        { title: '  ', description: 'whitespace title' },
      ],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics).toHaveLength(1)
    expect(result?.subTopics?.[0]?.title).toBe('valid')
  })

  it('should return undefined subTopics when not present in response', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      principle: 'Some principle',
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics).toBeUndefined()
  })

  it('should return undefined subTopics when subTopics is empty array after filtering', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      subTopics: [
        { title: '', description: '' },
      ],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics).toBeUndefined()
  })

  it('should handle subTopics being a non-array value gracefully', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      subTopics: 'not an array',
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics).toBeUndefined()
  })

  it('should handle subTopics with non-object entries', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      subTopics: ['string entry', 123, null, { title: 'valid', description: 'valid desc' }],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics).toHaveLength(1)
    expect(result?.subTopics?.[0]?.title).toBe('valid')
  })

  it('should filter keyPoints to only non-empty strings', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      subTopics: [
        { title: 'Valid', description: 'desc', keyPoints: ['point 1', '', '  ', 'point 2'] },
        { title: 'No points', description: 'desc', keyPoints: ['', '  '] },
      ],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics?.[0]?.keyPoints).toEqual(['point 1', 'point 2'])
    // keyPoints all filtered out → undefined
    expect(result?.subTopics?.[1]?.keyPoints).toBeUndefined()
  })

  it('should trim whitespace from title, description, and keyPoints', () => {
    const content = JSON.stringify({
      title: 'Test',
      description: 'Desc',
      subTopics: [
        { title: '  Hooks  ', description: '  Manage state  ', keyPoints: ['  point 1  '] },
      ],
      estimatedTime: 10,
    })

    const result = parseDeepResponse(content)
    expect(result).not.toBeNull()
    expect(result?.subTopics?.[0]).toEqual({
      title: 'Hooks',
      description: 'Manage state',
      keyPoints: ['point 1'],
    })
  })
})
