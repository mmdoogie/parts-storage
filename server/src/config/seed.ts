import { getDb, closeDb } from './database.js'

async function seed() {
  console.log('Seeding database...')

  const db = getDb()

  // Seed drawer sizes
  const insertSize = db.prepare(`
    INSERT OR IGNORE INTO drawer_sizes (name, width_units, height_units)
    VALUES (?, ?, ?)
  `)

  const sizes = [
    ['small', 1, 1],
    ['medium', 2, 1],
    ['large', 2, 2],
    ['wide', 4, 1],
    ['tall', 1, 2]
  ]

  for (const [name, width, height] of sizes) {
    insertSize.run(name, width, height)
  }
  console.log('  - Drawer sizes seeded')

  // Seed default wall
  const existingWall = db.prepare('SELECT id FROM walls LIMIT 1').get()
  if (!existingWall) {
    db.prepare(`
      INSERT INTO walls (name, grid_columns, grid_gap)
      VALUES (?, ?, ?)
    `).run('My Workshop Storage', 12, 16)
    console.log('  - Default wall created')
  }

  // Seed categories
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (name, color)
    VALUES (?, ?)
  `)

  const categories = [
    ['Resistors', '#E74C3C'],
    ['Capacitors', '#3498DB'],
    ['LEDs', '#F1C40F'],
    ['ICs', '#9B59B6'],
    ['Connectors', '#1ABC9C'],
    ['Hardware', '#7F8C8D'],
    ['Sensors', '#E67E22'],
    ['Misc', '#95A5A6']
  ]

  for (const [name, color] of categories) {
    insertCategory.run(name, color)
  }
  console.log('  - Categories seeded')

  // Seed layout templates
  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO layout_templates (name, description, columns, rows, layout_data, is_builtin)
    VALUES (?, ?, ?, ?, ?, 1)
  `)

  // Small parts organizer - 8x6 grid of small drawers
  const smallPartsLayout = []
  for (let row = 1; row <= 6; row++) {
    for (let col = 1; col <= 8; col++) {
      smallPartsLayout.push({ col, row, size: 'small' })
    }
  }
  insertTemplate.run(
    'Small Parts Organizer',
    '8 columns x 6 rows of small drawers (48 total)',
    8,
    6,
    JSON.stringify(smallPartsLayout)
  )

  // Mixed storage - 4 wide on top, 4x4 small below
  const mixedLayout = [
    { col: 1, row: 1, size: 'wide' },
    { col: 1, row: 2, size: 'wide' },
  ]
  for (let row = 3; row <= 6; row++) {
    for (let col = 1; col <= 4; col++) {
      mixedLayout.push({ col, row, size: 'small' })
    }
  }
  insertTemplate.run(
    'Mixed Storage',
    '2 wide drawers on top, 16 small drawers below',
    4,
    6,
    JSON.stringify(mixedLayout)
  )

  // Component drawer - 4x8 small
  const componentLayout = []
  for (let row = 1; row <= 8; row++) {
    for (let col = 1; col <= 4; col++) {
      componentLayout.push({ col, row, size: 'small' })
    }
  }
  insertTemplate.run(
    'Component Drawer',
    '4 columns x 8 rows of small drawers (32 total)',
    4,
    8,
    JSON.stringify(componentLayout)
  )
  console.log('  - Layout templates seeded')

  console.log('Seeding completed successfully!')
  closeDb()
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
