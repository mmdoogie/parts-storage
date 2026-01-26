#!/bin/sh
set -e

DB_PATH="${DATABASE_PATH:-/app/data/storage.db}"
FRESH_DB=false

# Check if this is a fresh database (file doesn't exist or is empty)
if [ ! -f "$DB_PATH" ] || [ ! -s "$DB_PATH" ]; then
  FRESH_DB=true
fi

echo "Running database migrations..."
node server/dist/config/migrate.js

# Only seed on fresh database
if [ "$FRESH_DB" = true ]; then
  echo "Seeding database (first run)..."
  node server/dist/config/seed.js
else
  echo "Database already initialized, skipping seed."
fi

echo "Starting MCP server..."
node mcp-server/dist/index.js &

echo "Starting main server..."
exec node server/dist/app.js
