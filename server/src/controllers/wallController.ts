import { Request, Response, NextFunction } from 'express'
import { getDb, toCamelCase } from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { storageEvents } from '../events.js'
import type { Wall, Case, Drawer, DrawerSize, Category } from '../types/index.js'

export function getWalls(_req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM walls ORDER BY id').all()
    const walls = rows.map(row => toCamelCase<Wall>(row as Record<string, unknown>))

    res.json({ success: true, data: walls })
  } catch (err) {
    next(err)
  }
}

export function getWall(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    // Get wall
    const wallRow = db.prepare('SELECT * FROM walls WHERE id = ?').get(id)
    if (!wallRow) {
      throw new AppError(404, 'NOT_FOUND', 'Wall not found')
    }
    const wall = toCamelCase<Wall>(wallRow as Record<string, unknown>)

    // Get cases with drawers
    const caseRows = db.prepare(`
      SELECT * FROM cases WHERE wall_id = ?
      ORDER BY grid_row_start, grid_column_start
    `).all(id)

    const cases = caseRows.map(caseRow => {
      const caseData = toCamelCase<Case>(caseRow as Record<string, unknown>)

      // Get drawers for this case
      const drawerRows = db.prepare(`
        SELECT d.*, ds.name as size_name, ds.width_units, ds.height_units
        FROM drawers d
        JOIN drawer_sizes ds ON d.drawer_size_id = ds.id
        WHERE d.case_id = ?
        ORDER BY d.grid_row, d.grid_column
      `).all(caseData.id)

      const drawers = drawerRows.map(drawerRow => {
        const dr = drawerRow as Record<string, unknown>
        const drawer = toCamelCase<Drawer>(dr)

        // Get part count and aggregated categories
        const partCount = db.prepare(`
          SELECT COUNT(*) as count FROM parts WHERE drawer_id = ?
        `).get(drawer.id) as { count: number }

        const categoryRows = db.prepare(`
          SELECT c.* FROM categories c
          JOIN drawer_categories dc ON c.id = dc.category_id
          WHERE dc.drawer_id = ?
        `).all(drawer.id)

        return {
          ...drawer,
          drawerSize: {
            id: dr.drawer_size_id as number,
            name: dr.size_name as string,
            widthUnits: dr.width_units as number,
            heightUnits: dr.height_units as number
          } as DrawerSize,
          partCount: partCount.count,
          categories: categoryRows.map(c => toCamelCase<Category>(c as Record<string, unknown>))
        }
      })

      return { ...caseData, drawers }
    })

    res.json({
      success: true,
      data: { ...wall, cases }
    })
  } catch (err) {
    next(err)
  }
}

export function createWall(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { name = 'New Wall', gridColumns = 12, gridGap = 16 } = req.body

    const result = db.prepare(`
      INSERT INTO walls (name, grid_columns, grid_gap)
      VALUES (?, ?, ?)
    `).run(name, gridColumns, gridGap)

    const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(result.lastInsertRowid)
    const wallData = toCamelCase<Wall>(wall as Record<string, unknown>)

    // Broadcast event
    storageEvents.broadcast({ type: 'wall:updated', wallId: wallData.id })

    res.status(201).json({
      success: true,
      data: wallData
    })
  } catch (err) {
    next(err)
  }
}

export function updateWall(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, gridColumns, gridGap } = req.body

    const existing = db.prepare('SELECT * FROM walls WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Wall not found')
    }

    db.prepare(`
      UPDATE walls
      SET name = COALESCE(?, name),
          grid_columns = COALESCE(?, grid_columns),
          grid_gap = COALESCE(?, grid_gap),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, gridColumns, gridGap, id)

    const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(id)
    const wallData = toCamelCase<Wall>(wall as Record<string, unknown>)

    // Broadcast event
    storageEvents.broadcast({ type: 'wall:updated', wallId: wallData.id })

    res.json({
      success: true,
      data: wallData
    })
  } catch (err) {
    next(err)
  }
}

export function deleteWall(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const wallId = parseInt(id)

    const existing = db.prepare('SELECT * FROM walls WHERE id = ?').get(wallId)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Wall not found')
    }

    db.prepare('DELETE FROM walls WHERE id = ?').run(wallId)

    // Broadcast event
    storageEvents.broadcast({ type: 'wall:updated', wallId })

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
