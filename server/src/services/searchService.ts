import { getDb } from '../config/database.js'
import type { SearchResult } from '../types/index.js'

export function search(query: string, options: { limit?: number; categoryId?: number } = {}): SearchResult[] {
  const db = getDb()
  const { limit = 50, categoryId } = options

  if (!query || query.trim().length < 1) {
    return []
  }

  const results: SearchResult[] = []
  const seen = new Set<string>()

  // Format query for FTS5 - handle partial matches
  const ftsQuery = query
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => `${t}*`)
    .join(' ')

  // Search parts using FTS5
  try {
    const ftsResults = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.notes,
        p.drawer_id,
        d.name as drawer_name,
        d.case_id,
        c.name as case_name,
        c.wall_id,
        w.name as wall_name,
        bm25(parts_fts) as score
      FROM parts_fts
      JOIN parts p ON parts_fts.rowid = p.id
      JOIN drawers d ON p.drawer_id = d.id
      JOIN cases c ON d.case_id = c.id
      JOIN walls w ON c.wall_id = w.id
      ${categoryId ? 'JOIN drawer_categories dc ON d.id = dc.drawer_id' : ''}
      WHERE parts_fts MATCH ?
      ${categoryId ? 'AND dc.category_id = ?' : ''}
      ORDER BY score
      LIMIT ?
    `).all(
      ftsQuery,
      ...(categoryId ? [categoryId] : []),
      limit
    ) as Record<string, unknown>[]

    for (const row of ftsResults) {
      const key = `part-${row.id}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({
          type: 'part',
          id: row.id as number,
          name: row.name as string,
          matchedField: 'name/notes',
          matchedText: (row.notes as string) || (row.name as string),
          score: row.score as number,
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
    }
  } catch {
    // FTS query might fail for certain patterns, fall back to LIKE
  }

  // Also search with LIKE for partial matches FTS might miss
  const likePattern = `%${query}%`

  const likeResults = db.prepare(`
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
    ${categoryId ? 'JOIN drawer_categories dc ON d.id = dc.drawer_id' : ''}
    WHERE (p.name LIKE ? OR p.notes LIKE ?)
    ${categoryId ? 'AND dc.category_id = ?' : ''}
    LIMIT ?
  `).all(
    likePattern,
    likePattern,
    ...(categoryId ? [categoryId] : []),
    limit
  ) as Record<string, unknown>[]

  for (const row of likeResults) {
    const key = `part-${row.id}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({
        type: 'part',
        id: row.id as number,
        name: row.name as string,
        matchedField: 'name/notes',
        matchedText: (row.notes as string) || (row.name as string),
        score: 0,
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
  }

  // Search links
  const linkResults = db.prepare(`
    SELECT
      p.id,
      p.name,
      pl.url,
      pl.title,
      p.drawer_id,
      d.name as drawer_name,
      d.case_id,
      c.name as case_name,
      c.wall_id,
      w.name as wall_name
    FROM part_links pl
    JOIN parts p ON pl.part_id = p.id
    JOIN drawers d ON p.drawer_id = d.id
    JOIN cases c ON d.case_id = c.id
    JOIN walls w ON c.wall_id = w.id
    WHERE pl.url LIKE ? OR pl.title LIKE ?
    LIMIT ?
  `).all(likePattern, likePattern, limit) as Record<string, unknown>[]

  for (const row of linkResults) {
    const key = `part-${row.id}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({
        type: 'part',
        id: row.id as number,
        name: row.name as string,
        matchedField: 'link',
        matchedText: (row.title as string) || (row.url as string),
        score: 0,
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
  }

  // Search drawer names
  const drawerResults = db.prepare(`
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
    WHERE d.name LIKE ?
    LIMIT ?
  `).all(likePattern, limit) as Record<string, unknown>[]

  for (const row of drawerResults) {
    const key = `drawer-${row.id}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({
        type: 'drawer',
        id: row.id as number,
        name: row.name as string,
        matchedField: 'name',
        matchedText: row.name as string,
        score: 0,
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

  // Search category names and include drawers in matching categories
  const categoryResults = db.prepare(`
    SELECT
      d.id,
      d.name,
      cat.name as category_name,
      d.case_id,
      c.name as case_name,
      c.wall_id,
      w.name as wall_name
    FROM categories cat
    JOIN drawer_categories dc ON cat.id = dc.category_id
    JOIN drawers d ON dc.drawer_id = d.id
    JOIN cases c ON d.case_id = c.id
    JOIN walls w ON c.wall_id = w.id
    WHERE cat.name LIKE ?
    LIMIT ?
  `).all(likePattern, limit) as Record<string, unknown>[]

  for (const row of categoryResults) {
    const key = `drawer-${row.id}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({
        type: 'drawer',
        id: row.id as number,
        name: row.name as string || `Drawer ${row.id}`,
        matchedField: 'category',
        matchedText: row.category_name as string,
        score: 0,
        path: {
          wallId: row.wall_id as number,
          wallName: row.wall_name as string,
          caseId: row.case_id as number,
          caseName: row.case_name as string,
          drawerId: row.id as number,
          drawerName: row.name as string | null
        }
      })
    }
  }

  return results.slice(0, limit)
}
