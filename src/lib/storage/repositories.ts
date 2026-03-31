import { db } from './db'
import type { StoredKnowledgeGraph, KnowledgeGraph, ImportResult, KnowledgeEdge } from '@/types'
import { generateId } from '@/lib/utils'
import type { KnowledgeNode } from '@/types'

/**
 * Graph Repository - Handles CRUD operations for knowledge graphs
 */
export class GraphRepository {
  /**
   * Get all graphs
   */
  static async getAll(): Promise<StoredKnowledgeGraph[]> {
    return await db.graphs.toArray()
  }

  /**
   * Get a graph by ID
   */
  static async getById(id: string): Promise<StoredKnowledgeGraph | undefined> {
    return await db.graphs.get(id)
  }

  /**
   * Save a graph
   */
  static async save(graph: KnowledgeGraph): Promise<void> {
    const storedGraph: StoredKnowledgeGraph = {
      id: graph.id,
      name: graph.name,
      description: graph.description,
      rootId: graph.rootId,
      nodes: Array.from(graph.nodes.values()).map((node) => ({
        ...node,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      })),
      edges: graph.edges,
      createdAt: graph.createdAt.toISOString(),
      updatedAt: graph.updatedAt.toISOString(),
    }

    await db.graphs.put(storedGraph)

    // 通知 UI 刷新图谱列表（仅在浏览器环境）
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('graph-updated'))
    }
  }

  /**
   * Delete a graph
   */
  static async delete(id: string): Promise<void> {
    await db.graphs.delete(id)
    // Also delete related snapshots
    await db.snapshots.where('graphId').equals(id).delete()
  }

  /**
   * Update graph metadata (name, description)
   */
  static async updateMetadata(
    id: string,
    updates: { name?: string; description?: string }
  ): Promise<void> {
    await db.graphs.update(id, updates)
  }

  /**
   * Get the most recently updated graph
   */
  static async getLatest(): Promise<StoredKnowledgeGraph | undefined> {
    return await db.graphs.orderBy('updatedAt').last()
  }

  /**
   * Search graphs by name
   */
  static async searchByName(query: string): Promise<StoredKnowledgeGraph[]> {
    const allGraphs = await db.graphs.toArray()
    const lowerQuery = query.toLowerCase()
    return allGraphs.filter((g) => g.name.toLowerCase().includes(lowerQuery))
  }
}

/**
 * Convert stored graph to runtime graph
 */
export function storedToRuntime(
  stored: StoredKnowledgeGraph
): KnowledgeGraph {
  const nodes = new Map<string, KnowledgeNode>()
  stored.nodes.forEach((node) => {
    nodes.set(node.id, {
      ...node,
      createdAt: new Date(node.createdAt),
      updatedAt: new Date(node.updatedAt),
      // Convert qas[].createdAt strings back to Date
      ...(node.qas ? {
        qas: node.qas.map((qa) => ({
          ...qa,
          createdAt: new Date(qa.createdAt),
        }))
      } : {}),
    })
  })

  // Convert edge type from string to RelationType
  const edges: KnowledgeEdge[] = stored.edges.map((edge) => ({
    ...edge,
    type: edge.type as KnowledgeEdge['type'],
  }))

  return {
    id: stored.id,
    name: stored.name,
    description: stored.description,
    rootId: stored.rootId,
    nodes,
    edges,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  }
}

/**
 * Export graph to JSON
 */
export function exportGraphToJson(graph: KnowledgeGraph): string {
  const storedGraph = {
    id: graph.id,
    name: graph.name,
    description: graph.description,
    rootId: graph.rootId,
    nodes: Array.from(graph.nodes.values()).map((node) => ({
      ...node,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    })),
    edges: graph.edges,
    createdAt: graph.createdAt.toISOString(),
    updatedAt: graph.updatedAt.toISOString(),
  }

  return JSON.stringify(
    {
      version: '1.0.0',
      graph: storedGraph,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  )
}

/**
 * Import graph from JSON
 */
export async function importGraphFromJson(json: string): Promise<ImportResult> {
  try {
    const data = JSON.parse(json)

    if (!data.graph) {
      return { success: false, error: 'Invalid format: missing graph data' }
    }

    // Generate new ID to avoid conflicts
    const newId = generateId()
    const graph = data.graph

    // Update graph with new ID
    graph.id = newId

    // Convert date strings back to Date objects
    graph.nodes = graph.nodes.map((node: KnowledgeNode) => ({
      ...node,
      createdAt: new Date(node.createdAt),
      updatedAt: new Date(node.updatedAt),
      // Convert qas[].createdAt strings back to Date
      ...(node.qas ? {
        qas: node.qas.map((qa) => ({
          ...qa,
          createdAt: new Date(qa.createdAt),
        }))
      } : {}),
    }))
    graph.createdAt = new Date(graph.createdAt)
    graph.updatedAt = new Date(graph.updatedAt)

    // Save to database (await the save operation)
    const runtimeGraph = storedToRuntime(graph)
    await GraphRepository.save(runtimeGraph)

    return { success: true, graphId: newId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
