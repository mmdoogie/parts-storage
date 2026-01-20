import { Request, Response, NextFunction } from 'express'
import { getDb, toCamelCase } from '../config/database.js'
import { AppError } from '../middleware/errorHandler.js'
import type { Case, Drawer, DrawerSize, Category, LayoutTemplate, DrawerPlacement } from '../types/index.js'

export function getCases(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { wallId } = req.query

    let query = 'SELECT * FROM cases'
    const params: unknown[] = []

    if (wallId) {
      query += ' WHERE wall_id = ?'
      params.push(wallId)
    }

    query += ' ORDER BY grid_row_start, grid_column_start'

    const rows = db.prepare(query).all(...params)
    const cases = rows.map(row => toCamelCase<Case>(row as Record<string, unknown>))

    res.json({ success: true, data: cases })
  } catch (err) {
    next(err)
  }
}

export function getCase(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)
    if (!caseRow) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found')
    }

    const caseData = toCamelCase<Case>(caseRow as Record<string, unknown>)

    // Get drawers with parts
    const drawerRows = db.prepare(`
      SELECT d.*, ds.name as size_name, ds.width_units, ds.height_units
      FROM drawers d
      JOIN drawer_sizes ds ON d.drawer_size_id = ds.id
      WHERE d.case_id = ?
      ORDER BY d.grid_row, d.grid_column
    `).all(id)

    const drawers = drawerRows.map(drawerRow => {
      const dr = drawerRow as Record<string, unknown>
      const drawer = toCamelCase<Drawer>(dr)

      const partCount = db.prepare(`
        SELECT COUNT(*) as count FROM parts WHERE drawer_id = ?
      `).get(drawer.id) as { count: number }

      const categoryRows = db.prepare(`
        SELECT DISTINCT c.* FROM categories c
        JOIN part_categories pc ON c.id = pc.category_id
        JOIN parts p ON pc.part_id = p.id
        WHERE p.drawer_id = ?
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

    res.json({
      success: true,
      data: { ...caseData, drawers }
    })
  } catch (err) {
    next(err)
  }
}

export function createCase(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const {
      wallId,
      sectionId = null,
      name = 'New Case',
      gridColumnStart = 1,
      gridColumnSpan = 3,
      gridRowStart = 1,
      gridRowSpan = 2,
      internalColumns = 4,
      internalRows = 6,
      color = '#8B7355'
    } = req.body

    if (!wallId) {
      throw new AppError(400, 'MISSING_FIELD', 'wallId is required')
    }

    const result = db.prepare(`
      INSERT INTO cases (wall_id, section_id, name, grid_column_start, grid_column_span,
        grid_row_start, grid_row_span, internal_columns, internal_rows, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(wallId, sectionId, name, gridColumnStart, gridColumnSpan,
           gridRowStart, gridRowSpan, internalColumns, internalRows, color)

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(result.lastInsertRowid)

    res.status(201).json({
      success: true,
      data: toCamelCase<Case>(caseRow as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function updateCase(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, sectionId, internalColumns, internalRows, color } = req.body

    const existing = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found')
    }

    db.prepare(`
      UPDATE cases
      SET name = COALESCE(?, name),
          section_id = COALESCE(?, section_id),
          internal_columns = COALESCE(?, internal_columns),
          internal_rows = COALESCE(?, internal_rows),
          color = COALESCE(?, color),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, sectionId, internalColumns, internalRows, color, id)

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)

    res.json({
      success: true,
      data: toCamelCase<Case>(caseRow as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function updateCasePosition(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { gridColumnStart, gridColumnSpan, gridRowStart, gridRowSpan } = req.body

    const existing = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found')
    }

    db.prepare(`
      UPDATE cases
      SET grid_column_start = COALESCE(?, grid_column_start),
          grid_column_span = COALESCE(?, grid_column_span),
          grid_row_start = COALESCE(?, grid_row_start),
          grid_row_span = COALESCE(?, grid_row_span),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(gridColumnStart, gridColumnSpan, gridRowStart, gridRowSpan, id)

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)

    res.json({
      success: true,
      data: toCamelCase<Case>(caseRow as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function deleteCase(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found')
    }

    db.prepare('DELETE FROM cases WHERE id = ?').run(id)

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}

export function applyTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { templateId } = req.body

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)
    if (!caseRow) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found')
    }

    const templateRow = db.prepare('SELECT * FROM layout_templates WHERE id = ?').get(templateId)
    if (!templateRow) {
      throw new AppError(404, 'NOT_FOUND', 'Template not found')
    }

    const template = toCamelCase<LayoutTemplate>(templateRow as Record<string, unknown>)
    const layoutData: DrawerPlacement[] = JSON.parse(template.layoutData as unknown as string)

    // Delete existing drawers
    db.prepare('DELETE FROM drawers WHERE case_id = ?').run(id)

    // Update case dimensions
    db.prepare(`
      UPDATE cases
      SET internal_columns = ?, internal_rows = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(template.columns, template.rows, id)

    // Create drawers from template
    const insertDrawer = db.prepare(`
      INSERT INTO drawers (case_id, drawer_size_id, grid_column, grid_row)
      VALUES (?, (SELECT id FROM drawer_sizes WHERE name = ?), ?, ?)
    `)

    for (const placement of layoutData) {
      insertDrawer.run(id, placement.size, placement.col, placement.row)
    }

    // Return updated case
    const updatedCase = db.prepare('SELECT * FROM cases WHERE id = ?').get(id)

    res.json({
      success: true,
      data: toCamelCase<Case>(updatedCase as Record<string, unknown>)
    })
  } catch (err) {
    next(err)
  }
}

export function getLayoutTemplates(_req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM layout_templates ORDER BY is_builtin DESC, name').all()

    const templates = rows.map(row => {
      const template = toCamelCase<LayoutTemplate>(row as Record<string, unknown>)
      return {
        ...template,
        layoutData: JSON.parse(template.layoutData as unknown as string)
      }
    })

    res.json({ success: true, data: templates })
  } catch (err) {
    next(err)
  }
}

export function createLayoutTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { name, description = null, columns, rows, layoutData } = req.body

    if (!name || columns === undefined || rows === undefined || !layoutData) {
      throw new AppError(400, 'MISSING_FIELD', 'name, columns, rows, and layoutData are required')
    }

    if (columns < 1 || rows < 1) {
      throw new AppError(400, 'INVALID_VALUE', 'Columns and rows must be at least 1')
    }

    // Validate layoutData is an array
    if (!Array.isArray(layoutData)) {
      throw new AppError(400, 'INVALID_VALUE', 'layoutData must be an array of drawer placements')
    }

    // Validate each drawer placement
    const drawerSizes = db.prepare('SELECT name FROM drawer_sizes').all() as Array<{ name: string }>
    const validSizeNames = drawerSizes.map(s => s.name)

    for (const placement of layoutData) {
      if (!placement.col || !placement.row || !placement.size) {
        throw new AppError(400, 'INVALID_VALUE', 'Each drawer placement must have col, row, and size')
      }
      if (!validSizeNames.includes(placement.size)) {
        throw new AppError(400, 'INVALID_VALUE', `Invalid drawer size: ${placement.size}`)
      }
    }

    // Check for duplicate name
    const existing = db.prepare('SELECT id FROM layout_templates WHERE name = ?').get(name)
    if (existing) {
      throw new AppError(409, 'DUPLICATE_NAME', 'A layout template with this name already exists')
    }

    const result = db.prepare(`
      INSERT INTO layout_templates (name, description, columns, rows, layout_data, is_builtin)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(name, description, columns, rows, JSON.stringify(layoutData))

    const templateRow = db.prepare('SELECT * FROM layout_templates WHERE id = ?').get(result.lastInsertRowid)
    const template = toCamelCase<LayoutTemplate>(templateRow as Record<string, unknown>)

    res.status(201).json({
      success: true,
      data: {
        ...template,
        layoutData: JSON.parse(template.layoutData as unknown as string)
      }
    })
  } catch (err) {
    next(err)
  }
}

export function updateLayoutTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, description, columns, rows, layoutData } = req.body

    const existing = db.prepare('SELECT * FROM layout_templates WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Layout template not found')
    }

    // Cannot modify built-in templates
    if (existing.is_builtin) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot modify built-in templates')
    }

    // Check for duplicate name (excluding current record)
    if (name) {
      const duplicate = db.prepare('SELECT id FROM layout_templates WHERE name = ? AND id != ?').get(name, id)
      if (duplicate) {
        throw new AppError(409, 'DUPLICATE_NAME', 'A layout template with this name already exists')
      }
    }

    if ((columns !== undefined && columns < 1) || (rows !== undefined && rows < 1)) {
      throw new AppError(400, 'INVALID_VALUE', 'Columns and rows must be at least 1')
    }

    // Validate layoutData if provided
    if (layoutData !== undefined) {
      if (!Array.isArray(layoutData)) {
        throw new AppError(400, 'INVALID_VALUE', 'layoutData must be an array of drawer placements')
      }

      const drawerSizes = db.prepare('SELECT name FROM drawer_sizes').all() as Array<{ name: string }>
      const validSizeNames = drawerSizes.map(s => s.name)

      for (const placement of layoutData) {
        if (!placement.col || !placement.row || !placement.size) {
          throw new AppError(400, 'INVALID_VALUE', 'Each drawer placement must have col, row, and size')
        }
        if (!validSizeNames.includes(placement.size)) {
          throw new AppError(400, 'INVALID_VALUE', `Invalid drawer size: ${placement.size}`)
        }
      }
    }

    const layoutDataStr = layoutData !== undefined ? JSON.stringify(layoutData) : null

    db.prepare(`
      UPDATE layout_templates
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          columns = COALESCE(?, columns),
          rows = COALESCE(?, rows),
          layout_data = COALESCE(?, layout_data)
      WHERE id = ?
    `).run(name, description, columns, rows, layoutDataStr, id)

    const templateRow = db.prepare('SELECT * FROM layout_templates WHERE id = ?').get(id)
    const template = toCamelCase<LayoutTemplate>(templateRow as Record<string, unknown>)

    res.json({
      success: true,
      data: {
        ...template,
        layoutData: JSON.parse(template.layoutData as unknown as string)
      }
    })
  } catch (err) {
    next(err)
  }
}

export function deleteLayoutTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const db = getDb()
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM layout_templates WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Layout template not found')
    }

    // Cannot delete built-in templates
    if (existing.is_builtin) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete built-in templates')
    }

    db.prepare('DELETE FROM layout_templates WHERE id = ?').run(id)

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
