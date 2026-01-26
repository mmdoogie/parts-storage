import { Request, Response, NextFunction } from 'express'
import { getDb, toCamelCase } from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { storageEvents } from '../events.js'
import { markFuzzyIndexStale } from '../services/fuzzySearchService.js'
import type { Part, PartLink } from '../types/index.js'

// Helper to get wallId from partId
function getWallIdFromPart(db: ReturnType<typeof getDb>, partId: number): number | undefined {
  const result = db.prepare(`
    SELECT c.wall_id FROM parts p
    JOIN drawers d ON p.drawer_id = d.id
    JOIN cases c ON d.case_id = c.id
    WHERE p.id = ?
  `).get(partId) as { wall_id: number } | undefined
  return result?.wall_id
}

// Helper to get wallId from drawerId
function getWallIdFromDrawer(db: ReturnType<typeof getDb>, drawerId: number): number | undefined {
  const result = db.prepare(`
    SELECT c.wall_id FROM drawers d
    JOIN cases c ON d.case_id = c.id
    WHERE d.id = ?
  `).get(drawerId) as { wall_id: number } | undefined
  return result?.wall_id
}

export function getParts(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { drawerId } = req.query

    if (!drawerId) {
      throw new AppError(400, 'MISSING_FIELD', 'drawerId query parameter is required')
    }

    const partRows = db.prepare(`
      SELECT * FROM parts WHERE drawer_id = ? ORDER BY sort_order, name
    `).all(drawerId)

    const parts = partRows.map(partRow => {
      const part = toCamelCase<Part>(partRow as Record<string, unknown>)

      const linkRows = db.prepare(`
        SELECT * FROM part_links WHERE part_id = ? ORDER BY sort_order
      `).all(part.id)

      return {
        ...part,
        links: linkRows.map(l => toCamelCase<PartLink>(l as Record<string, unknown>))
      }
    })

    res.json({ success: true, data: parts })
  } catch (err) {
    next(err)
  }
}

export function getPart(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const partRow = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
    if (!partRow) {
      throw new AppError(404, 'NOT_FOUND', 'Part not found')
    }

    const part = toCamelCase<Part>(partRow as Record<string, unknown>)

    const linkRows = db.prepare(`
      SELECT * FROM part_links WHERE part_id = ? ORDER BY sort_order
    `).all(id)

    res.json({
      success: true,
      data: {
        ...part,
        links: linkRows.map(l => toCamelCase<PartLink>(l as Record<string, unknown>))
      }
    })
  } catch (err) {
    next(err)
  }
}

export function createPart(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { drawerId, name, notes = null, sortOrder = 0 } = req.body

    if (!drawerId || !name) {
      throw new AppError(400, 'MISSING_FIELD', 'drawerId and name are required')
    }

    const drawerExists = db.prepare('SELECT id FROM drawers WHERE id = ?').get(drawerId)
    if (!drawerExists) {
      throw new AppError(404, 'NOT_FOUND', 'Drawer not found')
    }

    const result = db.prepare(`
      INSERT INTO parts (drawer_id, name, notes, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(drawerId, name, notes, sortOrder)

    const partRow = db.prepare('SELECT * FROM parts WHERE id = ?').get(result.lastInsertRowid)
    const part = toCamelCase<Part>(partRow as Record<string, unknown>)

    // Broadcast event
    const wallId = getWallIdFromDrawer(db, drawerId)
    if (wallId) {
      storageEvents.broadcast({ type: 'part:created', wallId, partId: part.id })
    }

    markFuzzyIndexStale()

    res.status(201).json({
      success: true,
      data: {
        ...part,
        links: []
      }
    })
  } catch (err) {
    next(err)
  }
}

export function updatePart(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, notes, sortOrder } = req.body

    const existing = db.prepare('SELECT * FROM parts WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Part not found')
    }

    // Use provided values, falling back to existing values only if undefined
    const newName = name !== undefined ? name : existing.name
    const newNotes = notes !== undefined ? notes : existing.notes
    const newSortOrder = sortOrder !== undefined ? sortOrder : existing.sort_order

    db.prepare(`
      UPDATE parts
      SET name = ?,
          notes = ?,
          sort_order = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newName, newNotes, newSortOrder, id)

    const partRow = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
    const part = toCamelCase<Part>(partRow as Record<string, unknown>)

    const linkRows = db.prepare(`
      SELECT * FROM part_links WHERE part_id = ? ORDER BY sort_order
    `).all(id)

    // Broadcast event
    const wallId = getWallIdFromPart(db, part.id)
    if (wallId) {
      storageEvents.broadcast({ type: 'part:updated', wallId, partId: part.id })
    }

    markFuzzyIndexStale()

    res.json({
      success: true,
      data: {
        ...part,
        links: linkRows.map(l => toCamelCase<PartLink>(l as Record<string, unknown>))
      }
    })
  } catch (err) {
    next(err)
  }
}

export function deletePart(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const partId = parseInt(id)

    const existing = db.prepare('SELECT * FROM parts WHERE id = ?').get(partId)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Part not found')
    }

    // Get wallId before deleting
    const wallId = getWallIdFromPart(db, partId)

    db.prepare('DELETE FROM parts WHERE id = ?').run(partId)

    // Broadcast event
    if (wallId) {
      storageEvents.broadcast({ type: 'part:deleted', wallId, partId })
    }

    markFuzzyIndexStale()

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}

export function movePart(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { targetDrawerId } = req.body

    const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
    if (!part) {
      throw new AppError(404, 'NOT_FOUND', 'Part not found')
    }

    const targetDrawer = db.prepare('SELECT id FROM drawers WHERE id = ?').get(targetDrawerId)
    if (!targetDrawer) {
      throw new AppError(404, 'NOT_FOUND', 'Target drawer not found')
    }

    db.prepare(`
      UPDATE parts
      SET drawer_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetDrawerId, id)

    const partRow = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)

    res.json({
      success: true,
      data: toCamelCase<Part>(partRow as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function addLinkToPart(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { url, title = null, sortOrder = 0 } = req.body

    const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
    if (!part) {
      throw new AppError(404, 'NOT_FOUND', 'Part not found')
    }

    if (!url) {
      throw new AppError(400, 'MISSING_FIELD', 'url is required')
    }

    const result = db.prepare(`
      INSERT INTO part_links (part_id, url, title, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(id, url, title, sortOrder)

    const link = db.prepare('SELECT * FROM part_links WHERE id = ?').get(result.lastInsertRowid)

    res.status(201).json({
      success: true,
      data: toCamelCase<PartLink>(link as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function updateLink(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { url, title, sortOrder } = req.body

    const existing = db.prepare('SELECT * FROM part_links WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Link not found')
    }

    // Use provided values, falling back to existing values only if undefined
    const newUrl = url !== undefined ? url : existing.url
    const newTitle = title !== undefined ? title : existing.title
    const newSortOrder = sortOrder !== undefined ? sortOrder : existing.sort_order

    db.prepare(`
      UPDATE part_links
      SET url = ?,
          title = ?,
          sort_order = ?
      WHERE id = ?
    `).run(newUrl, newTitle, newSortOrder, id)

    const link = db.prepare('SELECT * FROM part_links WHERE id = ?').get(id)

    res.json({
      success: true,
      data: toCamelCase<PartLink>(link as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function deleteLink(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM part_links WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Link not found')
    }

    db.prepare('DELETE FROM part_links WHERE id = ?').run(id)

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
