import { ref, readonly } from 'vue'
import { useWallStore } from '@/stores'
import * as drawerService from '@/services/drawerService'
import type { DragData, Case } from '@/types'

// Global drag state (shared across all components)
const isDragging = ref(false)

// Shared mutation timestamp for SSE cooldown (exported for WallView to use)
export const lastLocalMutation = ref(0)
export function markLocalMutation() {
  lastLocalMutation.value = Date.now()
}
const dragData = ref<DragData | null>(null)
const validDropTargets = ref<Set<string>>(new Set())
const dragOverTarget = ref<string | null>(null)

export function useDragDrop() {
  const wallStore = useWallStore()

  /**
   * Generates a unique key for a drop target slot
   */
  function getTargetKey(caseId: number, col: number, row: number): string {
    return `${caseId}-${col}-${row}`
  }

  /**
   * Check if a drawer would overlap with existing drawers in a case
   * Excludes the drawer being dragged from collision checks
   */
  function checkCollision(
    caseData: Case,
    targetCol: number,
    targetRow: number,
    widthUnits: number,
    heightUnits: number,
    excludeDrawerId?: number
  ): boolean {
    if (!caseData.drawers) return false

    for (const drawer of caseData.drawers) {
      // Skip the drawer being dragged
      if (excludeDrawerId && drawer.id === excludeDrawerId) continue

      const drawerWidth = drawer.widthUnits ?? 1
      const drawerHeight = drawer.heightUnits ?? 1

      // Check for overlap using AABB collision detection
      const xOverlap = targetCol < drawer.gridColumn + drawerWidth &&
                       targetCol + widthUnits > drawer.gridColumn
      const yOverlap = targetRow < drawer.gridRow + drawerHeight &&
                       targetRow + heightUnits > drawer.gridRow

      if (xOverlap && yOverlap) {
        return true // Collision detected
      }
    }

    return false // No collision
  }

  /**
   * Check if a position is within case bounds
   */
  function isWithinBounds(
    caseData: Case,
    col: number,
    row: number,
    widthUnits: number,
    heightUnits: number
  ): boolean {
    return col >= 1 &&
           row >= 1 &&
           col + widthUnits - 1 <= caseData.internalColumns &&
           row + heightUnits - 1 <= caseData.internalRows
  }

  /**
   * Calculate all valid drop targets for the current drag operation
   * across all cases in the current wall
   */
  function calculateValidTargets() {
    validDropTargets.value.clear()

    if (!dragData.value || dragData.value.type !== 'drawer') return

    const wall = wallStore.currentWall
    if (!wall?.cases) return

    const widthUnits = dragData.value.widthUnits ?? 1
    const heightUnits = dragData.value.heightUnits ?? 1

    // Check each case in the wall
    for (const caseData of wall.cases) {
      // Iterate through all possible positions in this case
      for (let col = 1; col <= caseData.internalColumns; col++) {
        for (let row = 1; row <= caseData.internalRows; row++) {
          // Check if drawer fits within bounds
          if (!isWithinBounds(caseData, col, row, widthUnits, heightUnits)) {
            continue
          }

          // Check for collisions with other drawers
          if (checkCollision(caseData, col, row, widthUnits, heightUnits, dragData.value.id)) {
            continue
          }

          // This position is valid
          validDropTargets.value.add(getTargetKey(caseData.id, col, row))
        }
      }
    }
  }

  /**
   * Start a drag operation
   */
  function startDrag(data: DragData, event?: DragEvent) {
    isDragging.value = true
    dragData.value = data

    // Set drag image and effect
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      // Set data with multiple MIME types for better compatibility
      const jsonData = JSON.stringify(data)
      event.dataTransfer.setData('text/plain', jsonData)
      event.dataTransfer.setData('application/json', jsonData)
    }

    // Calculate valid targets for visual feedback
    calculateValidTargets()
  }

  /**
   * End the drag operation and clean up state
   */
  function endDrag() {
    isDragging.value = false
    dragData.value = null
    validDropTargets.value.clear()
    dragOverTarget.value = null
  }

  /**
   * Check if dropping is allowed at a specific target
   */
  function canDrop(caseId: number, col: number, row: number): boolean {
    if (!dragData.value) return false
    return validDropTargets.value.has(getTargetKey(caseId, col, row))
  }

  /**
   * Check if a slot is a valid drop target (for visual highlighting)
   */
  function isValidTarget(caseId: number, col: number, row: number): boolean {
    if (!isDragging.value) return false
    return validDropTargets.value.has(getTargetKey(caseId, col, row))
  }

  /**
   * Check if this is the current drag-over target
   */
  function isDragOver(caseId: number, col: number, row: number): boolean {
    return dragOverTarget.value === getTargetKey(caseId, col, row)
  }

  /**
   * Set the current drag-over target (for highlighting)
   */
  function setDragOver(caseId: number, col: number, row: number) {
    const key = getTargetKey(caseId, col, row)
    if (validDropTargets.value.has(key)) {
      dragOverTarget.value = key
    }
  }

  /**
   * Clear the drag-over target
   */
  function clearDragOver() {
    dragOverTarget.value = null
  }

  /**
   * Handle the drop operation
   */
  async function handleDrop(caseId: number, col: number, row: number): Promise<boolean> {
    if (!dragData.value || !canDrop(caseId, col, row)) {
      endDrag()
      return false
    }

    const sourceCaseId = dragData.value.sourceCase
    const drawerId = dragData.value.id

    markLocalMutation() // Mark before API call so SSE events are ignored
    try {
      const movedDrawer = await drawerService.moveDrawer(drawerId, {
        targetCaseId: caseId,
        gridColumn: col,
        gridRow: row
      })

      // Update wall locally instead of full refresh
      if (sourceCaseId && sourceCaseId !== caseId) {
        // Moving to different case - remove from source, add to target
        wallStore.removeDrawerFromCase(sourceCaseId, drawerId)
        wallStore.addDrawerToCase(caseId, movedDrawer)
      } else {
        // Moving within same case - update position
        wallStore.updateDrawerInCase(caseId, drawerId, {
          gridColumn: col,
          gridRow: row
        })
      }

      return true
    } catch (e) {
      console.error('Failed to move drawer:', e)
      return false
    } finally {
      endDrag()
    }
  }

  return {
    // State (readonly)
    isDragging: readonly(isDragging),
    dragData: readonly(dragData),

    // Methods
    startDrag,
    endDrag,
    canDrop,
    isValidTarget,
    isDragOver,
    setDragOver,
    clearDragOver,
    handleDrop,
    getTargetKey
  }
}
