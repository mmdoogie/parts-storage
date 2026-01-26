# Multi-stage Dockerfile for storage-info
# Builds and serves the client, server, and MCP server together

# Stage 1: Build the client
FROM node:22-slim AS client-builder

ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./
COPY client/package.json ./client/

# Install all dependencies (workspaces)
RUN npm ci --workspace=client

# Copy client source
COPY client ./client

# Build the client
WORKDIR /app/client
RUN npm run build


# Stage 2: Build the server
FROM node:22-slim AS server-builder

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY server/package.json ./server/

# Install server dependencies
RUN npm ci --workspace=server

# Copy server source
COPY server ./server

# Build the server
WORKDIR /app/server
RUN npm run build


# Stage 3: Build the MCP server
FROM node:22-slim AS mcp-builder

ENV NODE_OPTIONS="--max-old-space-size=4096"

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY mcp-server/package.json ./mcp-server/

# Install MCP server dependencies
RUN npm ci --workspace=mcp-server

# Copy MCP server source
COPY mcp-server ./mcp-server

# Build the MCP server
WORKDIR /app/mcp-server
RUN npm run build


# Stage 4: Production image
FROM node:22-slim AS production

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY mcp-server/package.json ./mcp-server/

RUN npm ci --workspace=server --workspace=mcp-server --omit=dev

# Copy built artifacts
COPY --from=client-builder /app/client/dist ./client/dist
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=mcp-builder /app/mcp-server/dist ./mcp-server/dist

# Copy migrations for database initialization
COPY server/migrations ./server/migrations

# Copy startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3002
ENV MCP_PORT=3003
ENV DATABASE_PATH=/app/data/storage.db
ENV STATIC_PATH=/app/client/dist

# Expose ports
EXPOSE 3002 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/api/v1/walls').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start both servers with migrations
CMD ["./docker-entrypoint.sh"]
