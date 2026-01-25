import { Request, Response, NextFunction } from 'express'
import { getDb, toCamelCase } from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { storageEvents } from '../events.js'
import type { Drawer, Part, Category, PartLink } from '../types/index.js'

// Helper to get wallId from drawerId
function getWallIdFromDrawer(db: ReturnType<typeof getDb>, drawerId: number): number | undefined {
  const result = db.prepare(`
    SELECT c.wall_id FROM drawers d
    JOIN cases c ON d.case_id = c.id
    WHERE d.id = ?
  `).get(drawerId) as { wall_id: number } | undefined
  return result?.wall_id
}

export function getDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const drawerRow = db.prepare(`
      SELECT * FROM drawers WHERE id = ?
    `).get(id)

    if (!drawerRow) {
      throw new AppError(404, 'NOT_FOUND', 'Drawer not found')
    }

    const drawer = toCamelCase<Drawer>(drawerRow as Record<string, unknown>)

    // Get drawer categories
    const categoryRows = db.prepare(`
      SELECT c.* FROM categories c
      JOIN drawer_categories dc ON c.id = dc.category_id
      WHERE dc.drawer_id = ?
    `).all(id)
    const categories = categoryRows.map(c => toCamelCase<Category>(c as Record<string, unknown>))

    // Get parts with links
    const partRows = db.prepare(`
      SELECT * FROM parts WHERE drawer_id = ? ORDER BY sort_order, name
    `).all(id)

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

    res.json({
      success: true,
      data: {
        ...drawer,
        categories,
        parts
      }
    })
  } catch (err) {
    next(err)
  }
}

export function createDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { caseId, widthUnits = 1, heightUnits = 1, name = null, gridColumn, gridRow, color = '#FFE4B5' } = req.body

    if (!caseId || gridColumn === undefined || gridRow === undefined) {
      throw new AppError(400, 'MISSING_FIELD', 'caseId, gridColumn, and gridRow are required')
    }

    if (widthUnits < 1 || heightUnits < 1) {
      throw new AppError(400, 'INVALID_VALUE', 'widthUnits and heightUnits must be at least 1')
    }

    // Verify case exists and get its dimensions
    const caseData = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as Record<string, unknown> | undefined
    if (!caseData) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found')
    }

    // Check if drawer fits within case
    const caseColumns = caseData.internal_columns as number
    const caseRows = caseData.internal_rows as number

    if (gridColumn < 1 || gridColumn + widthUnits - 1 > caseColumns ||
        gridRow < 1 || gridRow + heightUnits - 1 > caseRows) {
      throw new AppError(400, 'INVALID_POSITION', 'Drawer does not fit at target position')
    }

    // Check for collision with other drawers
    const otherDrawers = db.prepare(`
      SELECT * FROM drawers WHERE case_id = ?
    `).all(caseId) as Record<string, unknown>[]

    for (const other of otherDrawers) {
      const otherCol = other.grid_column as number
      const otherRow = other.grid_row as number
      const otherWidth = other.width_units as number
      const otherHeight = other.height_units as number

      const xOverlap = gridColumn < otherCol + otherWidth && gridColumn + widthUnits > otherCol
      const yOverlap = gridRow < otherRow + otherHeight && gridRow + heightUnits > otherRow

      if (xOverlap && yOverlap) {
        throw new AppError(400, 'POSITION_OCCUPIED', 'Target position overlaps with another drawer')
      }
    }

    const result = db.prepare(`
      INSERT INTO drawers (case_id, width_units, height_units, name, grid_column, grid_row, color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(caseId, widthUnits, heightUnits, name, gridColumn, gridRow, color)

    const drawerRow = db.prepare('SELECT * FROM drawers WHERE id = ?').get(result.lastInsertRowid)
    const drawer = toCamelCase<Drawer>(drawerRow as Record<string, unknown>)

    // Broadcast event
    const wallId = getWallIdFromDrawer(db, drawer.id)
    if (wallId) {
      storageEvents.broadcast({ type: 'drawer:created', wallId, drawerId: drawer.id })
    }

    res.status(201).json({
      success: true,
      data: {
        ...drawer,
        categories: [],
        parts: []
      }
    })
  } catch (err) {
    next(err)
  }
}

export function updateDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, color } = req.body

    const existing = db.prepare('SELECT * FROM drawers WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Drawer not found')
    }

    // Build dynamic update - allow explicit null for name to clear it
    const updates: string[] = []
    const values: unknown[] = []

    // Check if name was explicitly provided (including null/empty string to clear)
    if ('name' in req.body) {
      updates.push('name = ?')
      // Convert empty string to null for consistency
      values.push(name === '' ? null : name)
    }

    if (color !== undefined) {
      updates.push('color = COALESCE(?, color)')
      values.push(color)
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP')
      values.push(id)

      db.prepare(`
        UPDATE drawers
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values)
    }

    const drawerRow = db.prepare('SELECT * FROM drawers WHERE id = ?').get(id)
    const drawer = toCamelCase<Drawer>(drawerRow as Record<string, unknown>)

    // Get drawer categories
    const categoryRows = db.prepare(`
      SELECT c.* FROM categories c
      JOIN drawer_categories dc ON c.id = dc.category_id
      WHERE dc.drawer_id = ?
    `).all(id)
    const categories = categoryRows.map(c => toCamelCase<Category>(c as Record<string, unknown>))

    // Get parts with links
    const partRows = db.prepare(`
      SELECT * FROM parts WHERE drawer_id = ? ORDER BY sort_order, name
    `).all(id)

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

    // Broadcast event
    const wallId = getWallIdFromDrawer(db, drawer.id)
    if (wallId) {
      storageEvents.broadcast({ type: 'drawer:updated', wallId, drawerId: drawer.id })
    }

    res.json({
      success: true,
      data: {
        ...drawer,
        categories,
        parts
      }
    })
  } catch (err) {
    next(err)
  }
}

export function moveDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { targetCaseId, gridColumn, gridRow } = req.body

    const drawer = db.prepare('SELECT * FROM drawers WHERE id = ?').get(id) as Record<string, unknown> | undefined

    if (!drawer) {
      throw new AppError(404, 'NOT_FOUND', 'Drawer not found')
    }

    const targetCase = db.prepare('SELECT * FROM cases WHERE id = ?').get(targetCaseId) as Record<string, unknown> | undefined
    if (!targetCase) {
      throw new AppError(404, 'NOT_FOUND', 'Target case not found')
    }

    // Check if target position is valid (within case bounds)
    const widthUnits = drawer.width_units as number
    const heightUnits = drawer.height_units as number
    const caseColumns = targetCase.internal_columns as number
    const caseRows = targetCase.internal_rows as number

    if (gridColumn < 1 || gridColumn + widthUnits - 1 > caseColumns ||
        gridRow < 1 || gridRow + heightUnits - 1 > caseRows) {
      throw new AppError(400, 'INVALID_POSITION', 'Drawer does not fit at target position')
    }

    // Check for collision with other drawers (excluding self)
    const otherDrawers = db.prepare(`
      SELECT * FROM drawers WHERE case_id = ? AND id != ?
    `).all(targetCaseId, id) as Record<string, unknown>[]

    for (const other of otherDrawers) {
      const otherCol = other.grid_column as number
      const otherRow = other.grid_row as number
      const otherWidth = other.width_units as number
      const otherHeight = other.height_units as number

      // Check for overlap
      const xOverlap = gridColumn < otherCol + otherWidth && gridColumn + widthUnits > otherCol
      const yOverlap = gridRow < otherRow + otherHeight && gridRow + heightUnits > otherRow

      if (xOverlap && yOverlap) {
        throw new AppError(400, 'POSITION_OCCUPIED', 'Target position overlaps with another drawer')
      }
    }

    // Move the drawer
    db.prepare(`
      UPDATE drawers
      SET case_id = ?, grid_column = ?, grid_row = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetCaseId, gridColumn, gridRow, id)

    const updatedDrawer = db.prepare('SELECT * FROM drawers WHERE id = ?').get(id)
    const movedDrawer = toCamelCase<Drawer>(updatedDrawer as Record<string, unknown>)

    // Broadcast event
    const wallId = getWallIdFromDrawer(db, movedDrawer.id)
    if (wallId) {
      storageEvents.broadcast({ type: 'drawer:updated', wallId, drawerId: movedDrawer.id })
    }

    res.json({
      success: true,
      data: movedDrawer
    })
  } catch (err) {
    next(err)
  }
}

export function deleteDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const drawerId = parseInt(id)

    const existing = db.prepare('SELECT * FROM drawers WHERE id = ?').get(drawerId)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Drawer not found')
    }

    // Get wallId before deleting
    const wallId = getWallIdFromDrawer(db, drawerId)

    db.prepare('DELETE FROM drawers WHERE id = ?').run(drawerId)

    // Broadcast event
    if (wallId) {
      storageEvents.broadcast({ type: 'drawer:deleted', wallId, drawerId })
    }

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}

export function addCategoryToDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { categoryId } = req.body

    if (!categoryId) {
      throw new AppError(400, 'MISSING_FIELD', 'categoryId is required')
    }

    // Verify drawer exists
    const drawer = db.prepare('SELECT id FROM drawers WHERE id = ?').get(id)
    if (!drawer) {
      throw new AppError(404, 'NOT_FOUND', 'Drawer not found')
    }

    // Verify category exists
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)
    if (!category) {
      throw new AppError(404, 'NOT_FOUND', 'Category not found')
    }

    // Add category (ignore if already exists)
    db.prepare(`
      INSERT OR IGNORE INTO drawer_categories (drawer_id, category_id)
      VALUES (?, ?)
    `).run(id, categoryId)

    // Return all categories for this drawer
    const categoryRows = db.prepare(`
      SELECT c.* FROM categories c
      JOIN drawer_categories dc ON c.id = dc.category_id
      WHERE dc.drawer_id = ?
      ORDER BY c.name
    `).all(id)

    const categories = categoryRows.map(c => toCamelCase<Category>(c as Record<string, unknown>))

    // Broadcast event
    const drawerId = parseInt(id)
    const wallId = getWallIdFromDrawer(db, drawerId)
    if (wallId) {
      storageEvents.broadcast({ type: 'drawer:updated', wallId, drawerId })
    }

    res.json({ success: true, data: categories })
  } catch (err) {
    next(err)
  }
}

export function removeCategoryFromDrawer(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id, categoryId } = req.params
    const drawerId = parseInt(id)

    db.prepare(`
      DELETE FROM drawer_categories
      WHERE drawer_id = ? AND category_id = ?
    `).run(id, categoryId)

    // Broadcast event
    const wallId = getWallIdFromDrawer(db, drawerId)
    if (wallId) {
      storageEvents.broadcast({ type: 'drawer:updated', wallId, drawerId })
    }

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
