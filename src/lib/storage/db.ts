import Dexie, { type Table } from 'dexie'
import type { StoredKnowledgeGraph, GraphSnapshot } from '@/types'

/**
 * OpenMyco IndexedDB Database
 */
export class OpenMycoDB extends Dexie {
  graphs!: Table<StoredKnowledgeGraph, string>
  snapshots!: Table<GraphSnapshot, string>

  constructor() {
    super('OpenLearningDB')

    // Define database schema
    this.version(1).stores({
      graphs: 'id, name, createdAt, updatedAt',
      snapshots: 'id, graphId, timestamp',
    })
  }
}

// Create a single instance
export const db = new OpenMycoDB()

/**
 * Initialize the database
 */
export async function initDB(): Promise<void> {
  try {
    await db.open()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
    throw error
  }
}

/**
 * Reset the database (for testing/debugging)
 */
export async function resetDB(): Promise<void> {
  try {
    await db.delete()
    await db.open()
    console.log('Database reset successfully')
  } catch (error) {
    console.error('Failed to reset database:', error)
    throw error
  }
}
