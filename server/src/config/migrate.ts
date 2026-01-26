import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDb, closeDb } from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Size name to dimensions mapping for migration
const SIZE_MAP: Record<string, { widthUnits: number; heightUnits: number }> = {
  'small': { widthUnits: 1, heightUnits: 1 },
  'medium': { widthUnits: 2, heightUnits: 1 },
  'large': { widthUnits: 2, heightUnits: 2 },
  'wide': { widthUnits: 4, heightUnits: 1 },
  'wide 3': { widthUnits: 3, heightUnits: 1 },
  'tall 3': { widthUnits: 1, heightUnits: 3 }
}

function columnExists(db: ReturnType<typeof getDb>, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return columns.some(col => col.name === column)
}

async function migrate() {
  console.log('Running migrations...')

  const db = getDb()

  const migrations = [
    '001_initial_schema.sql',
    '002_drawer_categories.sql',
    '003_drawer_dimensions.sql',
    '004_drop_drawer_sizes.sql',
    '005_remove_drawer_color.sql'
  ]

  for (const file of migrations) {
    // Handle 003 specially - only add columns if they don't exist
    if (file === '003_drawer_dimensions.sql') {
      console.log(`  Running ${file}...`)
      if (!columnExists(db, 'drawers', 'width_units')) {
        db.exec('ALTER TABLE drawers ADD COLUMN width_units INTEGER NOT NULL DEFAULT 1')
        db.exec('ALTER TABLE drawers ADD COLUMN height_units INTEGER NOT NULL DEFAULT 1')
        db.exec(`UPDATE drawers SET
          width_units = (SELECT width_units FROM drawer_sizes WHERE drawer_sizes.id = drawers.drawer_size_id),
          height_units = (SELECT height_units FROM drawer_sizes WHERE drawer_sizes.id = drawers.drawer_size_id)`)
      }
      continue
    }

    // Handle 004 specially - recreate table to remove foreign key column
    if (file === '004_drop_drawer_sizes.sql') {
      console.log(`  Running ${file}...`)
      if (columnExists(db, 'drawers', 'drawer_size_id')) {
        // Disable foreign keys and use transaction for table recreation
        db.exec('PRAGMA foreign_keys = OFF')
        db.exec('DROP TABLE IF EXISTS drawers_new')
        db.exec('BEGIN TRANSACTION')
        try {
          db.exec(`
            CREATE TABLE drawers_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              case_id INTEGER NOT NULL,
              name TEXT,
              grid_column INTEGER NOT NULL,
              grid_row INTEGER NOT NULL,
              width_units INTEGER NOT NULL DEFAULT 1,
              height_units INTEGER NOT NULL DEFAULT 1,
              color TEXT DEFAULT '#FFE4B5',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
            )
          `)
          db.exec(`
            INSERT INTO drawers_new (id, case_id, name, grid_column, grid_row, width_units, height_units, color, created_at, updated_at)
            SELECT id, case_id, name, grid_column, grid_row, width_units, height_units, color, created_at, updated_at
            FROM drawers
          `)
          db.exec('DROP TABLE drawers')
          db.exec('ALTER TABLE drawers_new RENAME TO drawers')
          db.exec('CREATE INDEX IF NOT EXISTS idx_drawers_case_id ON drawers(case_id)')
          db.exec('DROP TABLE IF EXISTS drawer_sizes')
          db.exec('COMMIT')
        } catch (err) {
          db.exec('ROLLBACK')
          throw err
        } finally {
          db.exec('PRAGMA foreign_keys = ON')
        }
      } else {
        db.exec('DROP TABLE IF EXISTS drawer_sizes')
      }
      continue
    }

    // Handle 005 specially - recreate table to remove color column
    if (file === '005_remove_drawer_color.sql') {
      console.log(`  Running ${file}...`)
      if (columnExists(db, 'drawers', 'color')) {
        db.exec('PRAGMA foreign_keys = OFF')
        db.exec('DROP TABLE IF EXISTS drawers_new')
        db.exec('BEGIN TRANSACTION')
        try {
          db.exec(`
            CREATE TABLE drawers_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              case_id INTEGER NOT NULL,
              name TEXT,
              grid_column INTEGER NOT NULL,
              grid_row INTEGER NOT NULL,
              width_units INTEGER NOT NULL DEFAULT 1,
              height_units INTEGER NOT NULL DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
            )
          `)
          db.exec(`
            INSERT INTO drawers_new (id, case_id, name, grid_column, grid_row, width_units, height_units, created_at, updated_at)
            SELECT id, case_id, name, grid_column, grid_row, width_units, height_units, created_at, updated_at
            FROM drawers
          `)
          db.exec('DROP TABLE drawers')
          db.exec('ALTER TABLE drawers_new RENAME TO drawers')
          db.exec('CREATE INDEX IF NOT EXISTS idx_drawers_case_id ON drawers(case_id)')
          db.exec('COMMIT')
        } catch (err) {
          db.exec('ROLLBACK')
          throw err
        } finally {
          db.exec('PRAGMA foreign_keys = ON')
        }
      }
      continue
    }

    const migrationPath = join(__dirname, '../../migrations', file)
    const migration = readFileSync(migrationPath, 'utf-8')
    console.log(`  Running ${file}...`)
    db.exec(migration)
  }

  // Post-migration: Convert layout_templates JSON from size names to dimensions
  console.log('  Converting layout template formats...')
  const templates = db.prepare('SELECT id, layout_data FROM layout_templates').all() as Array<{ id: number; layout_data: string }>

  const updateTemplate = db.prepare('UPDATE layout_templates SET layout_data = ? WHERE id = ?')

  for (const template of templates) {
    try {
      const layoutData = JSON.parse(template.layout_data) as Array<{ col: number; row: number; size?: string; widthUnits?: number; heightUnits?: number }>

      // Check if already converted (has widthUnits instead of size)
      if (layoutData.length > 0 && layoutData[0].widthUnits !== undefined) {
        continue // Already in new format
      }

      // Convert from size name to dimensions
      const newLayoutData = layoutData.map(placement => {
        const sizeName = placement.size || 'small'
        const dims = SIZE_MAP[sizeName] || SIZE_MAP['small']
        return {
          col: placement.col,
          row: placement.row,
          widthUnits: dims.widthUnits,
          heightUnits: dims.heightUnits
        }
      })

      updateTemplate.run(JSON.stringify(newLayoutData), template.id)
    } catch {
      console.warn(`  Warning: Could not convert layout template ${template.id}`)
    }
  }

  console.log('Migrations completed successfully!')
  closeDb()
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
