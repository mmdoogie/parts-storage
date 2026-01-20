-- Migration: Move categories from parts to drawers
-- This migration creates a drawer_categories join table and migrates existing data

-- Create new drawer_categories join table
CREATE TABLE IF NOT EXISTS drawer_categories (
    drawer_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (drawer_id, category_id),
    FOREIGN KEY (drawer_id) REFERENCES drawers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_drawer_categories_drawer_id ON drawer_categories(drawer_id);
CREATE INDEX IF NOT EXISTS idx_drawer_categories_category_id ON drawer_categories(category_id);

-- Migrate existing part categories to drawer categories
-- This aggregates all part categories to their parent drawer (distinct to avoid duplicates)
INSERT OR IGNORE INTO drawer_categories (drawer_id, category_id)
SELECT DISTINCT p.drawer_id, pc.category_id
FROM part_categories pc
JOIN parts p ON pc.part_id = p.id;

-- Drop the old part_categories table and its indexes
DROP INDEX IF EXISTS idx_part_categories_part_id;
DROP INDEX IF EXISTS idx_part_categories_category_id;
DROP TABLE IF EXISTS part_categories;
