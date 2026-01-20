import { Router, Request, Response, NextFunction } from 'express'
import * as wallController from '../controllers/wallController.js'
import * as caseController from '../controllers/caseController.js'
import * as drawerController from '../controllers/drawerController.js'
import * as partController from '../controllers/partController.js'
import * as categoryController from '../controllers/categoryController.js'
import { search } from '../services/searchService.js'

const router = Router()

// Walls
router.get('/walls', wallController.getWalls)
router.get('/walls/:id', wallController.getWall)
router.post('/walls', wallController.createWall)
router.put('/walls/:id', wallController.updateWall)
router.delete('/walls/:id', wallController.deleteWall)

// Cases
router.get('/cases', caseController.getCases)
router.get('/cases/:id', caseController.getCase)
router.post('/cases', caseController.createCase)
router.put('/cases/:id', caseController.updateCase)
router.put('/cases/:id/position', caseController.updateCasePosition)
router.post('/cases/:id/apply-template', caseController.applyTemplate)
router.delete('/cases/:id', caseController.deleteCase)

// Layout Templates
router.get('/layout-templates', caseController.getLayoutTemplates)
router.post('/layout-templates', caseController.createLayoutTemplate)
router.put('/layout-templates/:id', caseController.updateLayoutTemplate)
router.delete('/layout-templates/:id', caseController.deleteLayoutTemplate)

// Drawer Sizes
router.get('/drawer-sizes', drawerController.getDrawerSizes)
router.post('/drawer-sizes', drawerController.createDrawerSize)
router.put('/drawer-sizes/:id', drawerController.updateDrawerSize)
router.delete('/drawer-sizes/:id', drawerController.deleteDrawerSize)

// Drawers
router.get('/drawers/:id', drawerController.getDrawer)
router.post('/drawers', drawerController.createDrawer)
router.put('/drawers/:id', drawerController.updateDrawer)
router.put('/drawers/:id/move', drawerController.moveDrawer)
router.delete('/drawers/:id', drawerController.deleteDrawer)

// Drawer Categories
router.post('/drawers/:id/categories', drawerController.addCategoryToDrawer)
router.delete('/drawers/:id/categories/:categoryId', drawerController.removeCategoryFromDrawer)

// Parts
router.get('/parts', partController.getParts)
router.get('/parts/:id', partController.getPart)
router.post('/parts', partController.createPart)
router.put('/parts/:id', partController.updatePart)
router.put('/parts/:id/move', partController.movePart)
router.delete('/parts/:id', partController.deletePart)

// Part Links
router.post('/parts/:id/links', partController.addLinkToPart)
router.put('/links/:id', partController.updateLink)
router.delete('/links/:id', partController.deleteLink)

// Categories
router.get('/categories', categoryController.getCategories)
router.get('/categories/:id', categoryController.getCategory)
router.post('/categories', categoryController.createCategory)
router.put('/categories/:id', categoryController.updateCategory)
router.delete('/categories/:id', categoryController.deleteCategory)
router.get('/categories/:id/drawers', categoryController.getCategoryDrawers)

// Search
router.get('/search', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, category, limit } = req.query
    const results = search(
      q as string,
      {
        categoryId: category ? parseInt(category as string) : undefined,
        limit: limit ? parseInt(limit as string) : 50
      }
    )
    res.json({ success: true, data: results })
  } catch (err) {
    next(err)
  }
})

export default router
