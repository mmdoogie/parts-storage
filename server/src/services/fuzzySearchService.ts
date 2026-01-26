import Fuse, { IFuseOptions } from 'fuse.js'
import { getDb } from '../config/database.js'
import type { SearchResult } from '../types/index.js'

interface FuzzyIndexItem {
  type: 'part' | 'drawer' | 'category'
  id: number
  name: string
  searchableText: string
  path: {
    wallId: number
    wallName: string
    caseId: number
    caseName: string
    drawerId: number
    drawerName: string | null
  }
}

let fuseIndex: Fuse<FuzzyIndexItem> | null = null
let indexStale = true

const fuseOptions: IFuseOptions<FuzzyIndexItem> = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'searchableText', weight: 1 }
  ],
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true
}

function buildIndex(): FuzzyIndexItem[] {
  const db = getDb()
  const items: FuzzyIndexItem[] = []

  // Index all parts with their full path
  const parts = db.prepare(`
    SELECT
      p.id,
      p.name,
      p.notes,
      p.drawer_id,
      d.name as drawer_name,
      d.case_id,
      c.name as case_name,
      c.wall_id,
      w.name as wall_name
    FROM parts p
    JOIN drawers d ON p.drawer_id = d.id
    JOIN cases c ON d.case_id = c.id
    JOIN walls w ON c.wall_id = w.id
  `).all() as Record<string, unknown>[]

  for (const row of parts) {
    items.push({
      type: 'part',
      id: row.id as number,
      name: row.name as string,
      searchableText: [row.name, row.notes, row.drawer_name].filter(Boolean).join(' '),
      path: {
        wallId: row.wall_id as number,
        wallName: row.wall_name as string,
        caseId: row.case_id as number,
        caseName: row.case_name as string,
        drawerId: row.drawer_id as number,
        drawerName: row.drawer_name as string | null
      }
    })
  }

  // Index all drawers
  const drawers = db.prepare(`
    SELECT
      d.id,
      d.name,
      d.case_id,
      c.name as case_name,
      c.wall_id,
      w.name as wall_name
    FROM drawers d
    JOIN cases c ON d.case_id = c.id
    JOIN walls w ON c.wall_id = w.id
  `).all() as Record<string, unknown>[]

  for (const row of drawers) {
    if (row.name) {
      items.push({
        type: 'drawer',
        id: row.id as number,
        name: row.name as string,
        searchableText: row.name as string,
        path: {
          wallId: row.wall_id as number,
          wallName: row.wall_name as string,
          caseId: row.case_id as number,
          caseName: row.case_name as string,
          drawerId: row.id as number,
          drawerName: row.name as string
        }
      })
    }
  }

  // Index categories (matched against drawer path)
  const categories = db.prepare(`
    SELECT
      cat.id,
      cat.name,
      d.id as drawer_id,
      d.name as drawer_name,
      d.case_id,
      c.name as case_name,
      c.wall_id,
      w.name as wall_name
    FROM categories cat
    JOIN drawer_categories dc ON cat.id = dc.category_id
    JOIN drawers d ON dc.drawer_id = d.id
    JOIN cases c ON d.case_id = c.id
    JOIN walls w ON c.wall_id = w.id
  `).all() as Record<string, unknown>[]

  for (const row of categories) {
    items.push({
      type: 'category',
      id: row.id as number,
      name: row.name as string,
      searchableText: row.name as string,
      path: {
        wallId: row.wall_id as number,
        wallName: row.wall_name as string,
        caseId: row.case_id as number,
        caseName: row.case_name as string,
        drawerId: row.drawer_id as number,
        drawerName: row.drawer_name as string | null
      }
    })
  }

  return items
}

function ensureIndex(): Fuse<FuzzyIndexItem> {
  if (!fuseIndex || indexStale) {
    const items = buildIndex()
    fuseIndex = new Fuse(items, fuseOptions)
    indexStale = false
  }
  return fuseIndex
}

export function initFuzzyIndex(): void {
  // Build index in background (non-blocking)
  setImmediate(() => {
    try {
      ensureIndex()
      console.log('Fuzzy search index initialized')
    } catch (err) {
      console.error('Failed to initialize fuzzy search index:', err)
    }
  })
}

export function markFuzzyIndexStale(): void {
  indexStale = true
}

export function fuzzySearch(query: string, limit: number = 50): SearchResult[] {
  const fuse = ensureIndex()
  const results = fuse.search(query, { limit })

  return results.map(result => {
    const item = result.item

    if (item.type === 'category') {
      // For category matches, return the drawer
      return {
        type: 'drawer' as const,
        id: item.path.drawerId,
        name: item.path.drawerName || `Drawer ${item.path.drawerId}`,
        matchedField: 'fuzzy',
        matchedText: item.name,
        score: result.score ?? 1,
        path: item.path
      }
    }

    return {
      type: item.type,
      id: item.id,
      name: item.name,
      matchedField: 'fuzzy',
      matchedText: item.name,
      score: result.score ?? 1,
      path: item.path
    }
  })
}
