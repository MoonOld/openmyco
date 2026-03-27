import type { KnowledgeNode } from './knowledge'

// IndexedDB stored structure
export interface StoredKnowledgeGraph {
  id: string
  name: string
  description?: string
  rootId: string
  nodes: StoredKnowledgeNode[]
  edges: StoredKnowledgeEdge[]
  createdAt: string
  updatedAt: string
}

export interface StoredKnowledgeNode extends Omit<KnowledgeNode, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export interface StoredKnowledgeEdge {
  id: string
  source: string
  target: string
  type: string
  weight?: number
  label?: string
}

// Export format
export interface ExportFormat {
  version: string
  graph: StoredKnowledgeGraph
  exportedAt: string
}

// Import result
export interface ImportResult {
  success: boolean
  graphId?: string
  error?: string
}

// Storage metadata
export interface StorageMetadata {
  version: string
  lastUpdated: Date
}

export const STORAGE_VERSION = '1.0.0'
