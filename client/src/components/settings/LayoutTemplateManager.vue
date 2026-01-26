<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useSettingsStore } from '@/stores'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import type { LayoutTemplate, DrawerPlacement } from '@/types'

const settingsStore = useSettingsStore()

// Form state
const isAdding = ref(false)
const editingId = ref<number | null>(null)
const formData = ref({
  name: '',
  description: '',
  columns: 4,
  rows: 6,
  layoutData: [] as DrawerPlacement[]
})
const formError = ref<string | null>(null)
const deleteError = ref<string | null>(null)

// Drag state for drawing drawers
const dragState = reactive({
  isDragging: false,
  startCol: 0,
  startRow: 0,
  currentCol: 0,
  currentRow: 0
})

// Cell size for the editor
const CELL_SIZE = 32

// Computed for grid rendering
const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${formData.value.columns}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${formData.value.rows}, ${CELL_SIZE}px)`,
  gap: '2px',
  width: `${formData.value.columns * CELL_SIZE + (formData.value.columns - 1) * 2}px`,
  height: `${formData.value.rows * CELL_SIZE + (formData.value.rows - 1) * 2}px`
}))

// Calculate the preview rectangle while dragging
const dragPreview = computed(() => {
  if (!dragState.isDragging) return null
  const minCol = Math.min(dragState.startCol, dragState.currentCol)
  const maxCol = Math.max(dragState.startCol, dragState.currentCol)
  const minRow = Math.min(dragState.startRow, dragState.currentRow)
  const maxRow = Math.max(dragState.startRow, dragState.currentRow)
  return {
    col: minCol,
    row: minRow,
    widthUnits: maxCol - minCol + 1,
    heightUnits: maxRow - minRow + 1
  }
})

// Check if a drag preview is valid (no overlaps)
const isDragValid = computed(() => {
  if (!dragPreview.value) return false
  const preview = dragPreview.value

  // Check for overlap with existing drawers
  for (const drawer of formData.value.layoutData) {
    const xOverlap = preview.col < drawer.col + drawer.widthUnits &&
                     preview.col + preview.widthUnits > drawer.col
    const yOverlap = preview.row < drawer.row + drawer.heightUnits &&
                     preview.row + preview.heightUnits > drawer.row
    if (xOverlap && yOverlap) return false
  }

  return true
})

function resetForm() {
  formData.value = {
    name: '',
    description: '',
    columns: 4,
    rows: 6,
    layoutData: []
  }
  formError.value = null
  isAdding.value = false
  editingId.value = null
  resetDragState()
}

function resetDragState() {
  dragState.isDragging = false
  dragState.startCol = 0
  dragState.startRow = 0
  dragState.currentCol = 0
  dragState.currentRow = 0
}

function startAdd() {
  resetForm()
  isAdding.value = true
}

function startEdit(template: LayoutTemplate) {
  if (template.isBuiltin) return
  editingId.value = template.id
  formData.value = {
    name: template.name,
    description: template.description || '',
    columns: template.columns,
    rows: template.rows,
    layoutData: [...template.layoutData]
  }
  formError.value = null
  isAdding.value = false
}

function cancelEdit() {
  resetForm()
}

// Check if a cell is occupied by a drawer
function getCellDrawer(col: number, row: number): DrawerPlacement | null {
  for (const placement of formData.value.layoutData) {
    const colEnd = placement.col + placement.widthUnits
    const rowEnd = placement.row + placement.heightUnits

    if (col >= placement.col && col < colEnd && row >= placement.row && row < rowEnd) {
      return placement
    }
  }
  return null
}

// Get drawer placement at origin
function getDrawerAtOrigin(col: number, row: number): DrawerPlacement | null {
  return formData.value.layoutData.find(p => p.col === col && p.row === row) || null
}

// Mouse down - start drawing
function handleMouseDown(col: number, row: number, event: MouseEvent) {
  event.preventDefault()

  // If clicking on existing drawer, don't start drag
  if (getCellDrawer(col, row)) return

  dragState.isDragging = true
  dragState.startCol = col
  dragState.startRow = row
  dragState.currentCol = col
  dragState.currentRow = row
  formError.value = null
}

// Mouse enter cell while dragging
function handleMouseEnter(col: number, row: number) {
  if (!dragState.isDragging) return
  dragState.currentCol = col
  dragState.currentRow = row
}

// Mouse up - finish drawing
function handleMouseUp() {
  if (!dragState.isDragging) return

  if (isDragValid.value && dragPreview.value) {
    formData.value.layoutData.push({
      col: dragPreview.value.col,
      row: dragPreview.value.row,
      widthUnits: dragPreview.value.widthUnits,
      heightUnits: dragPreview.value.heightUnits
    })
  }

  resetDragState()
}

// Click on existing drawer to remove it
function handleDrawerClick(col: number, row: number) {
  const drawer = getDrawerAtOrigin(col, row)
  if (!drawer) return

  formData.value.layoutData = formData.value.layoutData.filter(
    p => !(p.col === drawer.col && p.row === drawer.row)
  )
}

async function saveTemplate() {
  formError.value = null

  if (!formData.value.name.trim()) {
    formError.value = 'Name is required'
    return
  }

  if (formData.value.columns < 1 || formData.value.rows < 1) {
    formError.value = 'Columns and rows must be at least 1'
    return
  }

  try {
    if (editingId.value) {
      await settingsStore.updateLayoutTemplate(editingId.value, {
        name: formData.value.name.trim(),
        description: formData.value.description.trim() || undefined,
        columns: formData.value.columns,
        rows: formData.value.rows,
        layoutData: formData.value.layoutData
      })
    } else {
      await settingsStore.createLayoutTemplate({
        name: formData.value.name.trim(),
        description: formData.value.description.trim() || undefined,
        columns: formData.value.columns,
        rows: formData.value.rows,
        layoutData: formData.value.layoutData
      })
    }
    resetForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to save template'
  }
}

async function deleteTemplate(id: number) {
  deleteError.value = null
  if (!confirm('Are you sure you want to delete this layout template?')) {
    return
  }

  try {
    await settingsStore.deleteLayoutTemplate(id)
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete template'
  }
}

// Helper to get drawer style for preview
function getDrawerStyle(placement: DrawerPlacement) {
  return {
    gridColumn: `${placement.col} / span ${placement.widthUnits}`,
    gridRow: `${placement.row} / span ${placement.heightUnits}`
  }
}

// Check if cell is within drag preview
function isCellInDragPreview(col: number, row: number): boolean {
  if (!dragPreview.value) return false
  const p = dragPreview.value
  return col >= p.col && col < p.col + p.widthUnits &&
         row >= p.row && row < p.row + p.heightUnits
}
</script>

<template>
  <div class="template-manager" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
    <div class="manager-header">
      <p class="manager-description">
        Create layout templates to quickly fill cases with predefined drawer arrangements.
      </p>
      <BaseButton v-if="!isAdding && !editingId" size="sm" @click="startAdd">
        Add Template
      </BaseButton>
    </div>

    <!-- Error message for delete -->
    <div v-if="deleteError" class="error-message">
      {{ deleteError }}
      <button class="dismiss-btn" @click="deleteError = null">Dismiss</button>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="isAdding || editingId" class="template-form">
      <h4>{{ editingId ? 'Edit Layout Template' : 'Add New Layout Template' }}</h4>

      <div class="form-grid">
        <div class="form-section">
          <BaseInput
            v-model="formData.name"
            label="Name"
            placeholder="e.g., Standard 4x6..."
          />
          <div class="text-field">
            <label class="input-label">Description</label>
            <textarea
              v-model="formData.description"
              placeholder="Optional description..."
              class="description-textarea"
            />
          </div>
          <div class="form-row form-row--split">
            <div class="number-field">
              <label class="input-label">Columns</label>
              <input
                v-model.number="formData.columns"
                type="number"
                min="1"
                max="20"
                class="number-input"
              />
            </div>
            <div class="number-field">
              <label class="input-label">Rows</label>
              <input
                v-model.number="formData.rows"
                type="number"
                min="1"
                max="20"
                class="number-input"
              />
            </div>
          </div>
        </div>

        <div class="form-section">
          <label class="input-label">Layout Editor</label>
          <p class="help-text">
            Click and drag to draw drawers. Click existing drawers to remove them.
          </p>
          <div class="grid-editor-wrapper">
            <div class="grid-editor" :style="gridStyle">
              <!-- Background grid cells for all positions -->
              <template v-for="row in formData.rows" :key="`bg-${row}`">
                <div
                  v-for="col in formData.columns"
                  :key="`bg-${col}-${row}`"
                  class="grid-cell-bg"
                  :class="{
                    'in-drag-preview': isCellInDragPreview(col, row),
                    'drag-valid': isCellInDragPreview(col, row) && isDragValid,
                    'drag-invalid': isCellInDragPreview(col, row) && !isDragValid
                  }"
                  :style="{ gridColumn: col, gridRow: row }"
                  @mousedown="handleMouseDown(col, row, $event)"
                  @mouseenter="handleMouseEnter(col, row)"
                />
              </template>
              <!-- Drawers placed on top -->
              <div
                v-for="(placement, idx) in formData.layoutData"
                :key="`drawer-${idx}`"
                class="grid-drawer"
                :style="getDrawerStyle(placement)"
                @click="handleDrawerClick(placement.col, placement.row)"
              >
                {{ placement.widthUnits }}x{{ placement.heightUnits }}
              </div>
              <!-- Drag preview -->
              <div
                v-if="dragState.isDragging && dragPreview"
                class="drag-preview"
                :class="{ 'is-valid': isDragValid, 'is-invalid': !isDragValid }"
                :style="getDrawerStyle(dragPreview)"
              >
                {{ dragPreview.widthUnits }}x{{ dragPreview.heightUnits }}
              </div>
            </div>
          </div>
          <div class="drawer-count">
            {{ formData.layoutData.length }} drawer(s)
          </div>
        </div>
      </div>

      <div v-if="formError" class="form-error">{{ formError }}</div>
      <div class="form-actions">
        <BaseButton size="sm" @click="saveTemplate" :loading="settingsStore.loading">
          {{ editingId ? 'Update' : 'Create' }}
        </BaseButton>
        <BaseButton size="sm" variant="ghost" @click="cancelEdit">
          Cancel
        </BaseButton>
      </div>
    </div>

    <!-- Templates List -->
    <div class="templates-list">
      <!-- Built-in Templates -->
      <div v-if="settingsStore.builtinTemplates.length" class="template-group">
        <h4 class="group-title">Built-in Templates</h4>
        <div
          v-for="template in settingsStore.builtinTemplates"
          :key="template.id"
          class="template-item template-item--builtin"
        >
          <div class="template-preview">
            <div
              class="preview-grid"
              :style="{
                gridTemplateColumns: `repeat(${template.columns}, 1fr)`,
                gridTemplateRows: `repeat(${template.rows}, 1fr)`
              }"
            >
              <div
                v-for="(placement, idx) in template.layoutData"
                :key="idx"
                class="preview-drawer"
                :style="getDrawerStyle(placement)"
              />
            </div>
          </div>
          <div class="template-info">
            <span class="template-name">{{ template.name }}</span>
            <span class="template-meta">
              {{ template.columns }}x{{ template.rows }} grid,
              {{ template.layoutData.length }} drawer(s)
            </span>
            <span v-if="template.description" class="template-description">
              {{ template.description }}
            </span>
          </div>
          <div class="template-badge">Built-in</div>
        </div>
      </div>

      <!-- Custom Templates -->
      <div class="template-group">
        <h4 class="group-title">Custom Templates</h4>
        <div
          v-for="template in settingsStore.customTemplates"
          :key="template.id"
          class="template-item"
          :class="{ editing: editingId === template.id }"
        >
          <div class="template-preview">
            <div
              class="preview-grid"
              :style="{
                gridTemplateColumns: `repeat(${template.columns}, 1fr)`,
                gridTemplateRows: `repeat(${template.rows}, 1fr)`
              }"
            >
              <div
                v-for="(placement, idx) in template.layoutData"
                :key="idx"
                class="preview-drawer"
                :style="getDrawerStyle(placement)"
              />
            </div>
          </div>
          <div class="template-info">
            <span class="template-name">{{ template.name }}</span>
            <span class="template-meta">
              {{ template.columns }}x{{ template.rows }} grid,
              {{ template.layoutData.length }} drawer(s)
            </span>
            <span v-if="template.description" class="template-description">
              {{ template.description }}
            </span>
          </div>
          <div class="template-actions">
            <BaseButton
              size="sm"
              variant="ghost"
              @click="startEdit(template)"
              :disabled="!!editingId || isAdding"
            >
              Edit
            </BaseButton>
            <BaseButton
              size="sm"
              variant="danger"
              @click="deleteTemplate(template.id)"
              :disabled="!!editingId || isAdding"
            >
              Delete
            </BaseButton>
          </div>
        </div>

        <p v-if="!settingsStore.customTemplates.length" class="empty-message">
          No custom templates yet.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-manager {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.manager-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.manager-description {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
  flex: 1;
}

.error-message {
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dismiss-btn {
  color: var(--color-danger);
  text-decoration: underline;
  font-size: var(--font-size-sm);
}

.template-form {
  background: rgba(0, 0, 0, 0.03);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.template-form h4 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
}

@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.form-row--split {
  display: flex;
  gap: var(--spacing-md);
}

.text-field,
.number-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.number-field {
  flex: 1;
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
}

.help-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.description-textarea {
  padding: var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  min-height: 60px;
  resize: vertical;
  font-family: inherit;
}

.description-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.number-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  width: 100%;
}

.number-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.grid-editor-wrapper {
  max-width: fit-content;
  user-select: none;
}

.grid-editor {
  background: var(--wood-medium, #8B7355);
  border-radius: var(--radius-sm);
  padding: 4px;
  position: relative;
}

.grid-cell-bg {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
  cursor: crosshair;
  transition: background-color var(--transition-fast);
}

.grid-cell-bg:hover {
  background: rgba(52, 152, 219, 0.3);
}

.grid-cell-bg.in-drag-preview {
  z-index: 1;
}

.grid-cell-bg.drag-valid {
  background: rgba(39, 174, 96, 0.4);
}

.grid-cell-bg.drag-invalid {
  background: rgba(231, 76, 60, 0.4);
}

.grid-drawer {
  background: var(--drawer-color, #FFE4B5);
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
  transition: all var(--transition-fast);
  z-index: 2;
}

.grid-drawer:hover {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.3);
}

.drag-preview {
  border: 3px dashed var(--color-success);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-success);
  background: rgba(39, 174, 96, 0.2);
  pointer-events: none;
  z-index: 3;
}

.drag-preview.is-invalid {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: rgba(231, 76, 60, 0.2);
}

.drawer-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.form-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.template-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.group-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.template-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.template-item:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.template-item.editing {
  opacity: 0.5;
}

.template-item--builtin {
  background: rgba(0, 0, 0, 0.02);
}

.template-preview {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-grid {
  display: grid;
  gap: 1px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  padding: 2px;
  width: 100%;
  height: 100%;
}

.preview-drawer {
  background: var(--drawer-color, #FFE4B5);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 1px;
}

.template-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.template-name {
  font-weight: 600;
}

.template-meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.template-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.template-badge {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.template-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.empty-message {
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--spacing-lg);
}
</style>
