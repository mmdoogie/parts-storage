import { Request, Response, NextFunction } from 'express'
import { getDb, toCamelCase } from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import type { Part, PartLink } from '../types/index.js'

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

    res.status(201).json({
      success: true,
      data: {
        ...toCamelCase<Part>(partRow as Record<string, unknown>),
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

    const existing = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Part not found')
    }

    db.prepare(`
      UPDATE parts
      SET name = COALESCE(?, name),
          notes = COALESCE(?, notes),
          sort_order = COALESCE(?, sort_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, notes, sortOrder, id)

    const partRow = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)

    const linkRows = db.prepare(`
      SELECT * FROM part_links WHERE part_id = ? ORDER BY sort_order
    `).all(id)

    res.json({
      success: true,
      data: {
        ...toCamelCase<Part>(partRow as Record<string, unknown>),
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

    const existing = db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Part not found')
    }

    db.prepare('DELETE FROM parts WHERE id = ?').run(id)

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

    const existing = db.prepare('SELECT * FROM part_links WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Link not found')
    }

    db.prepare(`
      UPDATE part_links
      SET url = COALESCE(?, url),
          title = COALESCE(?, title),
          sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(url, title, sortOrder, id)

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
