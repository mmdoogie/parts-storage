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

async function migrate() {
  console.log('Running migrations...')

  const db = getDb()

  const migrations = [
    '001_initial_schema.sql',
    '002_drawer_categories.sql',
    '003_drawer_dimensions.sql'
  ]

  for (const file of migrations) {
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
