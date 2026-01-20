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
    ['wide 3', 3, 1],
    ['tall 3', 1, 3]
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

  // Akro-Mils 10164 8x8 - 64 small drawers
  const akroMils8x8Layout = []
  for (let row = 1; row <= 8; row++) {
    for (let col = 1; col <= 8; col++) {
      akroMils8x8Layout.push({ col, row, size: 'small' })
    }
  }
  insertTemplate.run(
    'Akro-Mils 10164 8x8',
    '8 columns x 8 rows of small drawers (64 total)',
    8,
    8,
    JSON.stringify(akroMils8x8Layout)
  )

  // Akro-Mils 10144 32+12 - 32 small on top, 12 medium below
  const akroMils32x12Layout = []
  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= 8; col++) {
      akroMils32x12Layout.push({ col, row, size: 'small' })
    }
  }
  for (let row = 5; row <= 7; row++) {
    for (let col = 1; col <= 8; col += 2) {
      akroMils32x12Layout.push({ col, row, size: 'medium' })
    }
  }
  insertTemplate.run(
    'Akro-Mils 10144 32+12',
    '32 small drawers on top, 12 medium drawers below',
    8,
    7,
    JSON.stringify(akroMils32x12Layout)
  )

  // Akro-Mils 10116 4x4 - 16 small drawers
  const akroMils4x4Layout = []
  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= 4; col++) {
      akroMils4x4Layout.push({ col, row, size: 'small' })
    }
  }
  insertTemplate.run(
    'Akro-Mils 10116 4x4',
    '4 columns x 4 rows of small drawers (16 total)',
    4,
    4,
    JSON.stringify(akroMils4x4Layout)
  )

  // Cube 4 Drawer - 2x2 small
  insertTemplate.run(
    'Cube 4 Drawer',
    '2x2 grid of small drawers',
    2,
    2,
    JSON.stringify([
      { col: 1, row: 1, size: 'small' },
      { col: 2, row: 1, size: 'small' },
      { col: 1, row: 2, size: 'small' },
      { col: 2, row: 2, size: 'small' }
    ])
  )

  // Cube 3 Drawer - 1x3 small
  insertTemplate.run(
    'Cube 3 Drawer',
    '1 column x 3 rows of small drawers',
    1,
    3,
    JSON.stringify([
      { col: 1, row: 1, size: 'small' },
      { col: 1, row: 2, size: 'small' },
      { col: 1, row: 3, size: 'small' }
    ])
  )

  // Cube 2 Drawer - 1x2 small
  insertTemplate.run(
    'Cube 2 Drawer',
    '1 column x 2 rows of small drawers',
    1,
    2,
    JSON.stringify([
      { col: 1, row: 1, size: 'small' },
      { col: 1, row: 2, size: 'small' }
    ])
  )

  // Cube 6 Slot - 3 wide on top, 3 tall below
  insertTemplate.run(
    'Cube 6 Slot',
    '3 wide drawers on top, 3 tall drawers below',
    3,
    6,
    JSON.stringify([
      { col: 1, row: 1, size: 'wide 3' },
      { col: 1, row: 2, size: 'wide 3' },
      { col: 1, row: 3, size: 'wide 3' },
      { col: 1, row: 4, size: 'tall 3' },
      { col: 2, row: 4, size: 'tall 3' },
      { col: 3, row: 4, size: 'tall 3' }
    ])
  )

  // Cube 2+2 - 2 medium on top, 2 tall below
  insertTemplate.run(
    'Cube 2+2',
    '2 medium drawers on top, 2 tall drawers below',
    2,
    5,
    JSON.stringify([
      { col: 1, row: 1, size: 'medium' },
      { col: 1, row: 2, size: 'medium' },
      { col: 1, row: 3, size: 'tall 3' },
      { col: 2, row: 3, size: 'tall 3' }
    ])
  )

  console.log('  - Layout templates seeded')

  console.log('Seeding completed successfully!')
  closeDb()
}

seed().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
