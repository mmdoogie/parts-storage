-- Walls represent the entire storage wall view
CREATE TABLE IF NOT EXISTS walls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'My Storage Wall',
    grid_columns INTEGER NOT NULL DEFAULT 12,
    grid_gap INTEGER NOT NULL DEFAULT 16,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sections/Shelves for organizing cases on the wall
CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wall_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE
);

-- Cases are storage units containing drawers
CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER,
    wall_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    grid_column_start INTEGER NOT NULL DEFAULT 1,
    grid_column_span INTEGER NOT NULL DEFAULT 3,
    grid_row_start INTEGER NOT NULL DEFAULT 1,
    grid_row_span INTEGER NOT NULL DEFAULT 2,
    internal_columns INTEGER NOT NULL DEFAULT 4,
    internal_rows INTEGER NOT NULL DEFAULT 6,
    color TEXT DEFAULT '#8B7355',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
);

-- Drawer size templates
CREATE TABLE IF NOT EXISTS drawer_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    width_units INTEGER NOT NULL DEFAULT 1,
    height_units INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual drawers within cases
CREATE TABLE IF NOT EXISTS drawers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    drawer_size_id INTEGER NOT NULL,
    name TEXT,
    grid_column INTEGER NOT NULL,
    grid_row INTEGER NOT NULL,
    color TEXT DEFAULT '#FFE4B5',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (drawer_size_id) REFERENCES drawer_sizes(id)
);

-- Categories for organizing parts
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3498db',
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Parts stored in drawers
CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drawer_id) REFERENCES drawers(id) ON DELETE CASCADE
);

-- Part-Category relationship (many-to-many)
CREATE TABLE IF NOT EXISTS part_categories (
    part_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (part_id, category_id),
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Links attached to parts
CREATE TABLE IF NOT EXISTS part_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

-- Layout templates for quick case setup
CREATE TABLE IF NOT EXISTS layout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    columns INTEGER NOT NULL,
    rows INTEGER NOT NULL,
    layout_data TEXT NOT NULL,
    is_builtin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_wall_id ON cases(wall_id);
CREATE INDEX IF NOT EXISTS idx_cases_section_id ON cases(section_id);
CREATE INDEX IF NOT EXISTS idx_drawers_case_id ON drawers(case_id);
CREATE INDEX IF NOT EXISTS idx_parts_drawer_id ON parts(drawer_id);
CREATE INDEX IF NOT EXISTS idx_part_categories_part_id ON part_categories(part_id);
CREATE INDEX IF NOT EXISTS idx_part_categories_category_id ON part_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_part_links_part_id ON part_links(part_id);

-- Full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS parts_fts USING fts5(
    name,
    notes,
    content='parts',
    content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS parts_ai AFTER INSERT ON parts BEGIN
    INSERT INTO parts_fts(rowid, name, notes) VALUES (new.id, new.name, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS parts_ad AFTER DELETE ON parts BEGIN
    INSERT INTO parts_fts(parts_fts, rowid, name, notes) VALUES('delete', old.id, old.name, old.notes);
END;

CREATE TRIGGER IF NOT EXISTS parts_au AFTER UPDATE ON parts BEGIN
    INSERT INTO parts_fts(parts_fts, rowid, name, notes) VALUES('delete', old.id, old.name, old.notes);
    INSERT INTO parts_fts(rowid, name, notes) VALUES (new.id, new.name, new.notes);
END;
