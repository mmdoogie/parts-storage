import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDb, closeDb } from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function migrate() {
  console.log('Running migrations...')

  const db = getDb()

  const migrations = [
    '001_initial_schema.sql',
    '002_drawer_categories.sql'
  ]

  for (const file of migrations) {
    const migrationPath = join(__dirname, '../../migrations', file)
    const migration = readFileSync(migrationPath, 'utf-8')
    console.log(`  Running ${file}...`)
    db.exec(migration)
  }

  console.log('Migrations completed successfully!')
  closeDb()
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
