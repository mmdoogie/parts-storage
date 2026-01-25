<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import type { Case } from '@/types'
import { useSearchStore } from '@/stores'
import StorageCase from '@/components/case/StorageCase.vue'

// Reference to the wall element for consistent position calculations
const wallRef = ref<HTMLElement | null>(null)

interface Props {
  cases: Case[]
  gridColumns?: number
}

const props = withDefaults(defineProps<Props>(), {
  gridColumns: 12
})

const emit = defineEmits<{
  'case-click': [caseData: Case]
  'drawer-click': [drawerId: number]
  'add-drawer': [caseId: number, column: number, row: number]
  'edit-case': [caseId: number]
  'case-move': [caseId: number, newColumn: number, newRow: number]
  'case-resize': [caseId: number, newColumnSpan: number, newRowSpan: number]
}>()

const searchStore = useSearchStore()

// Case drag state
const isDraggingCase = ref(false)
const draggingCaseId = ref<number | null>(null)
const draggingCaseSize = ref({ columnSpan: 1, rowSpan: 1 })

// Case resize state
const isResizingCase = ref(false)
const resizingCaseId = ref<number | null>(null)
const resizingCaseStart = ref({ col: 1, row: 1 })
const resizePreview = ref<{ colSpan: number; rowSpan: number; isValid: boolean } | null>(null)

// Calculate the maximum row used by cases to size the grid
const maxRow = computed(() => {
  if (!props.cases.length) return 2
  return Math.max(...props.cases.map(c => c.gridRowStart + c.gridRowSpan - 1)) + 1
})

const gridStyle = computed(() => ({
  '--wall-columns': props.gridColumns,
  '--wall-rows': maxRow.value
}))

function handleCaseDragStart(caseId: number, event: DragEvent) {
  isDraggingCase.value = true
  draggingCaseId.value = caseId
  const caseData = props.cases.find(c => c.id === caseId)
  if (caseData) {
    draggingCaseSize.value = {
      columnSpan: caseData.gridColumnSpan,
      rowSpan: caseData.gridRowSpan
    }
  }
}

// Preview position state
const previewPosition = ref<{ col: number; row: number; isValid: boolean } | null>(null)

function handleCaseDragEnd() {
  isDraggingCase.value = false
  draggingCaseId.value = null
  previewPosition.value = null
}

// Resize handlers
function handleResizeStart(caseId: number, event: MouseEvent) {
  const caseData = props.cases.find(c => c.id === caseId)
  if (!caseData) return

  isResizingCase.value = true
  resizingCaseId.value = caseId
  resizingCaseStart.value = {
    col: caseData.gridColumnStart,
    row: caseData.gridRowStart
  }
  resizePreview.value = {
    colSpan: caseData.gridColumnSpan,
    rowSpan: caseData.gridRowSpan,
    isValid: true
  }

  // Add global mouse listeners
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeEnd)
}

function handleResizeMove(event: MouseEvent) {
  if (!isResizingCase.value || !resizingCaseId.value) return

  const wall = wallRef.value
  if (!wall) return

  const rect = wall.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const computedStyle = getComputedStyle(wall)
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 24
  const paddingTop = parseFloat(computedStyle.paddingTop) || 24

  const gap = 16
  const availableWidth = rect.width - paddingLeft * 2
  const availableHeight = rect.height - paddingTop * 2
  const cellWidth = (availableWidth - (props.gridColumns - 1) * gap) / props.gridColumns
  const rows = maxRow.value
  const cellHeight = (availableHeight - (rows - 1) * gap) / rows

  // Calculate which column/row the mouse is over
  const mouseCol = Math.max(1, Math.floor((x - paddingLeft) / (cellWidth + gap)) + 1)
  const mouseRow = Math.max(1, Math.floor((y - paddingTop) / (cellHeight + gap)) + 1)

  // Calculate new span based on mouse position relative to case start
  const newColSpan = Math.max(1, mouseCol - resizingCaseStart.value.col + 1)
  const newRowSpan = Math.max(1, mouseRow - resizingCaseStart.value.row + 1)

  // Check if valid
  const isValid = isValidCaseResize(resizingCaseStart.value.col, resizingCaseStart.value.row, newColSpan, newRowSpan)

  resizePreview.value = {
    colSpan: newColSpan,
    rowSpan: newRowSpan,
    isValid
  }
}

function handleResizeEnd() {
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)

  if (resizingCaseId.value && resizePreview.value?.isValid) {
    emit('case-resize', resizingCaseId.value, resizePreview.value.colSpan, resizePreview.value.rowSpan)
  }

  isResizingCase.value = false
  resizingCaseId.value = null
  resizePreview.value = null
}

function isValidCaseResize(col: number, row: number, colSpan: number, rowSpan: number): boolean {
  // Check right boundary
  if (col + colSpan - 1 > props.gridColumns) return false

  // Check for collisions with other cases (excluding the one being resized)
  for (const c of props.cases) {
    if (c.id === resizingCaseId.value) continue

    const xOverlap = col < c.gridColumnStart + c.gridColumnSpan &&
                     col + colSpan > c.gridColumnStart
    const yOverlap = row < c.gridRowStart + c.gridRowSpan &&
                     row + rowSpan > c.gridRowStart

    if (xOverlap && yOverlap) return false
  }

  return true
}

// Cleanup resize listeners on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)
})

// Check if a position is valid for dropping a case
function isValidCaseDropPosition(col: number, row: number): boolean {
  if (!isDraggingCase.value || !draggingCaseId.value) {
    return false
  }

  const { columnSpan, rowSpan } = draggingCaseSize.value

  // Check bounds
  if (col + columnSpan - 1 > props.gridColumns) return false
  if (col < 1 || row < 1) return false

  // Check for collisions with other cases (excluding the one being dragged)
  for (const c of props.cases) {
    if (c.id === draggingCaseId.value) continue

    const xOverlap = col < c.gridColumnStart + c.gridColumnSpan &&
                     col + columnSpan > c.gridColumnStart
    const yOverlap = row < c.gridRowStart + c.gridRowSpan &&
                     row + rowSpan > c.gridRowStart

    if (xOverlap && yOverlap) return false
  }

  return true
}

// Calculate grid position from mouse coordinates
function calculateGridPosition(event: DragEvent): { col: number; row: number } {
  // Always use the wall element for consistent calculations
  const wall = wallRef.value
  if (!wall) return { col: 1, row: 1 }

  const rect = wall.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const computedStyle = getComputedStyle(wall)
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 24
  const paddingTop = parseFloat(computedStyle.paddingTop) || 24

  const gap = 16
  const availableWidth = rect.width - paddingLeft * 2
  const availableHeight = rect.height - paddingTop * 2
  const cellWidth = (availableWidth - (props.gridColumns - 1) * gap) / props.gridColumns
  const rows = maxRow.value
  const cellHeight = (availableHeight - (rows - 1) * gap) / rows

  const col = Math.max(1, Math.min(props.gridColumns, Math.floor((x - paddingLeft) / (cellWidth + gap)) + 1))
  const row = Math.max(1, Math.floor((y - paddingTop) / (cellHeight + gap)) + 1)

  return { col, row }
}

function handleWallDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'

  // Update preview position during drag
  if (isDraggingCase.value) {
    const { col, row } = calculateGridPosition(event)
    const isValid = isValidCaseDropPosition(col, row)
    previewPosition.value = { col, row, isValid }
  }
}

function handleWallDrop(event: DragEvent) {
  event.preventDefault()

  // Try to get drag data from dataTransfer (more reliable than component state)
  let jsonData = event.dataTransfer?.getData('application/json')
  if (!jsonData) {
    jsonData = event.dataTransfer?.getData('text/plain')
  }

  let caseId = draggingCaseId.value

  if (jsonData) {
    try {
      const data = JSON.parse(jsonData)
      if (data.type === 'case') {
        caseId = data.id
        // Update local state if we got it from dataTransfer
        draggingCaseId.value = caseId
        draggingCaseSize.value = { columnSpan: data.columnSpan, rowSpan: data.rowSpan }
      }
    } catch (e) {
      // Fall back to component state
    }
  }

  if (!caseId) {
    handleCaseDragEnd()
    return
  }

  // Use the preview position if available (it's already validated)
  // This ensures drop matches exactly what the user saw
  if (previewPosition.value && previewPosition.value.isValid) {
    emit('case-move', caseId, previewPosition.value.col, previewPosition.value.row)
  }

  handleCaseDragEnd()
}
</script>

<template>
  <div
    ref="wallRef"
    class="storage-wall"
    :class="{ 'is-dragging-case': isDraggingCase }"
    :style="gridStyle"
    @dragover.prevent="handleWallDragOver"
    @drop.prevent="handleWallDrop"
  >
    <StorageCase
      v-for="caseData in cases"
      :key="caseData.id"
      :class="{
        'is-being-dragged': isDraggingCase && caseData.id === draggingCaseId,
        'is-being-resized': isResizingCase && caseData.id === resizingCaseId
      }"
      :case-data="caseData"
      :highlighted-drawer-ids="searchStore.highlightedDrawerIds"
      @click="emit('case-click', caseData)"
      @drawer-click="emit('drawer-click', $event)"
      @add-drawer="(caseId, col, row) => emit('add-drawer', caseId, col, row)"
      @edit-case="emit('edit-case', $event)"
      @case-drag-start="handleCaseDragStart"
      @case-drag-end="handleCaseDragEnd"
      @resize-start="handleResizeStart"
    />

    <div v-if="!cases.length" class="wall-empty">
      <p>No storage cases yet.</p>
      <p class="wall-empty-hint">Add a case to get started!</p>
    </div>

    <!-- Drop preview for case dragging -->
    <div
      v-if="previewPosition"
      class="case-drop-preview"
      :class="{ 'is-valid': previewPosition.isValid, 'is-invalid': !previewPosition.isValid }"
      :style="{
        '--preview-col': previewPosition.col,
        '--preview-row': previewPosition.row,
        '--preview-col-span': draggingCaseSize.columnSpan,
        '--preview-row-span': draggingCaseSize.rowSpan
      }"
    />

    <!-- Resize preview for case resizing -->
    <div
      v-if="resizePreview && resizingCaseId"
      class="case-resize-preview"
      :class="{ 'is-valid': resizePreview.isValid, 'is-invalid': !resizePreview.isValid }"
      :style="{
        '--preview-col': resizingCaseStart.col,
        '--preview-row': resizingCaseStart.row,
        '--preview-col-span': resizePreview.colSpan,
        '--preview-row-span': resizePreview.rowSpan
      }"
    />

    <!-- Drop zone overlay for case dragging -->
    <div
      v-if="isDraggingCase"
      class="case-drop-overlay"
      @dragover.prevent="handleWallDragOver"
      @drop.prevent="handleWallDrop"
    />
  </div>
</template>

<style scoped>
.storage-wall {
  display: grid;
  grid-template-columns: repeat(var(--wall-columns, 12), 1fr);
  grid-template-rows: repeat(var(--wall-rows, 3), 80px);
  gap: var(--wall-gap, 16px);
  padding: var(--wall-padding, 24px);
  min-height: 400px;
  overflow: auto;
  position: relative;
}

.wall-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
  text-align: center;
}

.wall-empty-hint {
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-xs);
}

@media (max-width: 767px) {
  .storage-wall {
    /* On mobile, switch to single-column auto-flow layout */
    grid-template-columns: 1fr;
    grid-template-rows: none;
    grid-auto-rows: auto;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .storage-wall {
    grid-template-rows: repeat(var(--wall-rows, 3), 70px);
  }
}

/* Visual feedback during case dragging */
.storage-wall.is-dragging-case {
  outline: 2px dashed var(--color-primary);
  outline-offset: -2px;
}

/* Dim the case being dragged */
.is-being-dragged {
  opacity: 0.4;
}

/* Drop preview showing where case will land */
.case-drop-preview {
  grid-column: var(--preview-col) / span var(--preview-col-span);
  grid-row: var(--preview-row) / span var(--preview-row-span);
  border: 3px dashed var(--color-primary);
  border-radius: var(--radius-md);
  background: rgba(52, 152, 219, 0.15);
  pointer-events: none;
  z-index: 50;
  transition: grid-column 0.1s ease, grid-row 0.1s ease;
}

.case-drop-preview.is-valid {
  border-color: var(--color-success);
  background: rgba(39, 174, 96, 0.15);
}

.case-drop-preview.is-invalid {
  border-color: var(--color-danger);
  background: rgba(231, 76, 60, 0.15);
}

/* Resize preview */
.case-resize-preview {
  grid-column: var(--preview-col) / span var(--preview-col-span);
  grid-row: var(--preview-row) / span var(--preview-row-span);
  border: 3px dashed var(--color-primary);
  border-radius: var(--radius-md);
  background: rgba(52, 152, 219, 0.15);
  pointer-events: none;
  z-index: 50;
  transition: grid-column 0.05s ease, grid-row 0.05s ease;
}

.case-resize-preview.is-valid {
  border-color: var(--color-success);
  background: rgba(39, 174, 96, 0.15);
}

.case-resize-preview.is-invalid {
  border-color: var(--color-danger);
  background: rgba(231, 76, 60, 0.15);
}

/* Case being resized - dim slightly */
.is-being-resized {
  opacity: 0.6;
}

/* Overlay to capture drop events during case dragging */
.case-drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  cursor: move;
  background: rgba(0, 0, 0, 0.01);
}
</style>
