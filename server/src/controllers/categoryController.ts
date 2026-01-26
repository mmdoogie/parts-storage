import { Request, Response, NextFunction } from 'express'
import { getDb, toCamelCase } from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import { markFuzzyIndexStale } from '../services/fuzzySearchService.js'
import type { Category } from '../types/index.js'

export function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM categories ORDER BY name').all()
    const categories = rows.map(row => toCamelCase<Category>(row as Record<string, unknown>))

    res.json({ success: true, data: categories })
  } catch (err) {
    next(err)
  }
}

export function getCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Category not found')
    }

    res.json({
      success: true,
      data: toCamelCase<Category>(row as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { name, color = '#3498db', icon = null } = req.body

    if (!name) {
      throw new AppError(400, 'MISSING_FIELD', 'name is required')
    }

    const result = db.prepare(`
      INSERT INTO categories (name, color, icon)
      VALUES (?, ?, ?)
    `).run(name, color, icon)

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)

    markFuzzyIndexStale()

    res.status(201).json({
      success: true,
      data: toCamelCase<Category>(category as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, color, icon } = req.body

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Category not found')
    }

    db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          color = COALESCE(?, color),
          icon = COALESCE(?, icon),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, color, icon, id)

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)

    markFuzzyIndexStale()

    res.json({
      success: true,
      data: toCamelCase<Category>(category as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Category not found')
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id)

    markFuzzyIndexStale()

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}

export function getCategoryDrawers(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    if (!category) {
      throw new AppError(404, 'NOT_FOUND', 'Category not found')
    }

    const drawers = db.prepare(`
      SELECT d.*, c.name as case_name, c.wall_id, w.name as wall_name
      FROM drawers d
      JOIN drawer_categories dc ON d.id = dc.drawer_id
      JOIN cases c ON d.case_id = c.id
      JOIN walls w ON c.wall_id = w.id
      WHERE dc.category_id = ?
      ORDER BY d.name
    `).all(id)

    res.json({
      success: true,
      data: drawers.map(d => {
        const drawer = d as Record<string, unknown>
        return {
          id: drawer.id,
          name: drawer.name,
          path: {
            wallId: drawer.wall_id,
            wallName: drawer.wall_name,
            caseId: drawer.case_id,
            caseName: drawer.case_name
          }
        }
      })
    })
  } catch (err) {
    next(err)
  }
}
