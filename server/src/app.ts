import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import routes from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { closeDb } from './config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline styles for development
}))
app.use(cors())
app.use(compression({
  // Don't compress SSE responses - they need to stream unbuffered
  filter: (req, res) => {
    if (req.path === '/api/v1/events') {
      return false
    }
    return compression.filter(req, res)
  }
}))
app.use(express.json())

// API routes
app.use('/api/v1', routes)

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = process.env.STATIC_PATH || join(__dirname, '../../client/dist')
  app.use(express.static(clientPath))
  app.get('*', (_req, res) => {
    res.sendFile(join(clientPath, 'index.html'))
  })
}

// Error handler
app.use(errorHandler)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...')
  closeDb()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...')
  closeDb()
  process.exit(0)
})

// Start server
const HOST = process.env.HOST || '0.0.0.0'
app.listen(Number(PORT), HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
  console.log(`API available at http://${HOST}:${PORT}/api/v1`)
})

export default app
