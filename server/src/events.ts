import { EventEmitter } from 'events'
import type { Response } from 'express'

// Event types that can be broadcast
export type StorageEventType =
  | 'wall:updated'
  | 'case:created' | 'case:updated' | 'case:deleted'
  | 'drawer:created' | 'drawer:updated' | 'drawer:deleted'
  | 'part:created' | 'part:updated' | 'part:deleted'
  | 'category:created' | 'category:updated' | 'category:deleted'

export interface StorageEvent {
  type: StorageEventType
  wallId?: number
  caseId?: number
  drawerId?: number
  partId?: number
  categoryId?: number
  timestamp: number
}

class StorageEventEmitter extends EventEmitter {
  private clients: Set<Response> = new Set()

  constructor() {
    super()
    this.setMaxListeners(100) // Support many SSE connections
  }

  addClient(res: Response) {
    this.clients.add(res)

    // Remove client when connection closes
    res.on('close', () => {
      this.clients.delete(res)
    })
  }

  removeClient(res: Response) {
    this.clients.delete(res)
  }

  broadcast(event: Omit<StorageEvent, 'timestamp'>) {
    const fullEvent: StorageEvent = {
      ...event,
      timestamp: Date.now()
    }

    const data = `data: ${JSON.stringify(fullEvent)}\n\n`

    for (const client of this.clients) {
      client.write(data)
      // Flush to ensure data is sent immediately through any proxies
      if (typeof (client as any).flush === 'function') {
        (client as any).flush()
      }
    }

    // Also emit locally for any server-side listeners
    this.emit('storage-event', fullEvent)
  }

  getClientCount(): number {
    return this.clients.size
  }
}

// Singleton instance
export const storageEvents = new StorageEventEmitter()
