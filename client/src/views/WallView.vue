<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useWallStore, useDrawerStore, useCategoryStore, useSearchStore } from '@/stores'
import { lastLocalMutation, markLocalMutation } from '@/composables/useDragDrop'
import * as caseService from '@/services/caseService'
import type { LayoutTemplate, Case } from '@/types'
import StorageWall from '@/components/wall/StorageWall.vue'
import DrawerOpen from '@/components/drawer/DrawerOpen.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import SearchResults from '@/components/search/SearchResults.vue'
import CasePropertiesModal from '@/components/case/CasePropertiesModal.vue'

const wallStore = useWallStore()
const drawerStore = useDrawerStore()
const categoryStore = useCategoryStore()
const searchStore = useSearchStore()

// Scroll position preservation
const wallViewRef = ref<HTMLElement | null>(null)
let savedScrollPosition = { x: 0, y: 0 }

function saveScrollPosition() {
  if (wallViewRef.value) {
    savedScrollPosition = {
      x: wallViewRef.value.scrollLeft,
      y: wallViewRef.value.scrollTop
    }
  }
  // Also save window scroll position
  savedScrollPosition.y = window.scrollY
  savedScrollPosition.x = window.scrollX
}

async function restoreScrollPosition() {
  await nextTick()
  window.scrollTo(savedScrollPosition.x, savedScrollPosition.y)
}

// Wrap wall fetches to preserve scroll position
async function refreshWall() {
  if (!wallStore.currentWall) return
  saveScrollPosition()
  await wallStore.fetchWall(wallStore.currentWall.id)
  await restoreScrollPosition()
}

const openDrawerId = ref<number | null>(null)
const newCaseName = ref('New Case')
const selectedTemplate = ref<number | null>(null)
const templates = ref<LayoutTemplate[]>([])
const loading = ref(false)

// New case position and size
const newCaseColumnStart = ref(1)
const newCaseColumnSpan = ref(4)
const newCaseRowStart = ref(1)
const newCaseRowSpan = ref(3)

// Add drawer state
const isAddingDrawer = ref(false)
const addDrawerCaseId = ref<number | null>(null)
const addDrawerColumn = ref(1)
const addDrawerRow = ref(1)
const addDrawerWidth = ref(1)
const addDrawerHeight = ref(1)
const addDrawerName = ref('')
const addDrawerLoading = ref(false)

// Edit case state
const isEditingCase = ref(false)
const editingCaseData = ref<Case | null>(null)

// SSE connection for real-time updates
let eventSource: EventSource | null = null
let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
const REFRESH_DEBOUNCE = 500 // Wait for events to settle before refreshing
const LOCAL_MUTATION_COOLDOWN = 1000 // Ignore SSE events for 1s after local mutation

function scheduleRefresh() {
  // Clear any pending refresh
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer)
  }
  // Schedule a new refresh - resets each time an event arrives
  refreshDebounceTimer = setTimeout(() => {
    refreshDebounceTimer = null
    refreshWall()
  }, REFRESH_DEBOUNCE)
}

function setupSSE() {
  // Connect to SSE endpoint via proxy
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const sseUrl = `${apiBase}/events`

  eventSource = new EventSource(sseUrl)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      // Skip connected message
      if (data.type === 'connected') return

      // Skip part events - they don't affect wall display and are handled locally in drawer modal
      if (data.type?.startsWith('part:')) return

      // Skip events during cooldown after local mutations (likely our own events)
      if (Date.now() - lastLocalMutation.value < LOCAL_MUTATION_COOLDOWN) return

      // Check if event is relevant to current wall
      if (wallStore.currentWall && data.wallId === wallStore.currentWall.id) {
        scheduleRefresh()
      }
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  }

  eventSource.onerror = () => {
    // Reconnect after error
    eventSource?.close()
    setTimeout(setupSSE, 5000)
  }
}

function cleanupSSE() {
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer)
    refreshDebounceTimer = null
  }
  eventSource?.close()
  eventSource = null
}

onMounted(async () => {
  await wallStore.fetchWalls()
  if (wallStore.walls.length > 0) {
    await wallStore.fetchWall(wallStore.walls[0].id)
  }
  await categoryStore.fetchCategories()
  templates.value = await caseService.getLayoutTemplates()

  // Setup SSE for real-time updates
  setupSSE()
})

onUnmounted(() => {
  cleanupSSE()
})

const cases = computed(() => wallStore.currentWall?.cases || [])
const gridColumns = computed(() => wallStore.currentWall?.gridColumns || 12)

// Find the next available position that doesn't overlap with existing cases
function findNextAvailablePosition(existingCases: Case[], width: number, height: number, maxColumns: number): { col: number; row: number } {
  if (existingCases.length === 0) {
    return { col: 1, row: 1 }
  }

  // Build an occupancy grid
  const maxRow = Math.max(...existingCases.map(c => c.gridRowStart + c.gridRowSpan - 1)) + height
  const occupied = new Set<string>()

  for (const c of existingCases) {
    for (let col = c.gridColumnStart; col < c.gridColumnStart + c.gridColumnSpan; col++) {
      for (let row = c.gridRowStart; row < c.gridRowStart + c.gridRowSpan; row++) {
        occupied.add(`${col},${row}`)
      }
    }
  }

  // Try to find a spot by scanning row by row
  for (let row = 1; row <= maxRow; row++) {
    for (let col = 1; col <= maxColumns - width + 1; col++) {
      let fits = true
      for (let dc = 0; dc < width && fits; dc++) {
        for (let dr = 0; dr < height && fits; dr++) {
          if (occupied.has(`${col + dc},${row + dr}`)) {
            fits = false
          }
        }
      }
      if (fits) {
        return { col, row }
      }
    }
  }

  // If no spot found, add below all existing cases
  return { col: 1, row: maxRow + 1 }
}

// Watch for store modal open and initialize position
watch(() => wallStore.showAddCaseModal, (isOpen) => {
  if (isOpen) {
    const pos = findNextAvailablePosition(cases.value, newCaseColumnSpan.value, newCaseRowSpan.value, gridColumns.value)
    newCaseColumnStart.value = pos.col
    newCaseRowStart.value = pos.row
  }
})

// Update case name when a template is selected
watch(selectedTemplate, (templateId) => {
  if (templateId) {
    const template = templates.value.find(t => t.id === templateId)
    if (template) {
      newCaseName.value = template.name
    }
  } else {
    newCaseName.value = 'New Case'
  }
})

// Scroll to top when search becomes active
watch(() => searchStore.isActive, (isActive) => {
  if (isActive) {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
})

function handleDrawerClick(drawerId: number) {
  openDrawerId.value = drawerId
  drawerStore.setOpenDrawer(drawerId)
}

async function handleHighlightDrawer(drawerId: number, wallId: number) {
  // Switch to the correct wall if needed
  if (wallStore.currentWall?.id !== wallId) {
    await wallStore.fetchWall(wallId)
  }

  searchStore.highlightDrawer(drawerId)
  // Scroll to the highlighted drawer after wall has rendered
  nextTick(() => {
    const drawerElement = document.querySelector(`[data-drawer-id="${drawerId}"]`)
    if (drawerElement) {
      drawerElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

function closeDrawer() {
  // Sync drawer changes to wall store before closing
  if (openDrawerId.value) {
    const updatedDrawer = drawerStore.drawers.get(openDrawerId.value)
    if (updatedDrawer) {
      wallStore.updateDrawerInCase(updatedDrawer.caseId, updatedDrawer.id, {
        name: updatedDrawer.name
      })
      markLocalMutation()
    }
  }
  openDrawerId.value = null
  drawerStore.setOpenDrawer(null)
}

async function addCase() {
  if (!wallStore.currentWall) return

  loading.value = true
  markLocalMutation() // Mark before API call so SSE events are ignored
  try {
    const newCase = await caseService.createCase({
      wallId: wallStore.currentWall.id,
      name: newCaseName.value,
      gridColumnStart: newCaseColumnStart.value,
      gridColumnSpan: newCaseColumnSpan.value,
      gridRowStart: newCaseRowStart.value,
      gridRowSpan: newCaseRowSpan.value,
      internalColumns: 4,
      internalRows: 6
    })

    // Apply template if selected
    if (selectedTemplate.value) {
      await caseService.applyTemplate(newCase.id, selectedTemplate.value)
      // Template creates drawers server-side, need to refresh just this case
      await refreshWall()
    } else {
      // No template, add case locally with empty drawers
      wallStore.addCaseToWall({ ...newCase, drawers: [] })
    }

    wallStore.closeAddCaseModal()
    newCaseName.value = 'New Case'
    selectedTemplate.value = null
    // Reset position for next case
    newCaseColumnStart.value = 1
    newCaseColumnSpan.value = 4
    newCaseRowStart.value = 1
    newCaseRowSpan.value = 3
  } catch (e) {
    console.error('Failed to create case:', e)
  } finally {
    loading.value = false
  }
}

function handleAddDrawer(caseId: number, column: number, row: number) {
  addDrawerCaseId.value = caseId
  addDrawerColumn.value = column
  addDrawerRow.value = row
  addDrawerWidth.value = 1
  addDrawerHeight.value = 1
  addDrawerName.value = ''
  isAddingDrawer.value = true
}

function closeAddDrawerModal() {
  isAddingDrawer.value = false
  addDrawerCaseId.value = null
  addDrawerWidth.value = 1
  addDrawerHeight.value = 1
  addDrawerName.value = ''
}

async function createDrawer() {
  if (!addDrawerCaseId.value || !isDrawerSizeValid.value) return

  addDrawerLoading.value = true
  markLocalMutation() // Mark before API call so SSE events are ignored
  try {
    const newDrawer = await drawerStore.createDrawer({
      caseId: addDrawerCaseId.value,
      widthUnits: addDrawerWidth.value,
      heightUnits: addDrawerHeight.value,
      gridColumn: addDrawerColumn.value,
      gridRow: addDrawerRow.value,
      name: addDrawerName.value.trim() || undefined
    })

    // Add drawer to case locally instead of refreshing wall
    wallStore.addDrawerToCase(addDrawerCaseId.value, newDrawer)

    closeAddDrawerModal()

    // Optionally open the newly created drawer for editing
    handleDrawerClick(newDrawer.id)
  } catch (e) {
    console.error('Failed to create drawer:', e)
  } finally {
    addDrawerLoading.value = false
  }
}

// Get the case name for display in the add drawer modal
const addDrawerCaseName = computed(() => {
  if (!addDrawerCaseId.value) return ''
  const caseData = cases.value.find(c => c.id === addDrawerCaseId.value)
  return caseData?.name || 'Unknown Case'
})

// Get the case data for the add drawer modal
const addDrawerCase = computed(() => {
  if (!addDrawerCaseId.value) return null
  return cases.value.find(c => c.id === addDrawerCaseId.value) || null
})

// Computed for validating drawer size at selected position
const isDrawerSizeValid = computed(() => {
  const caseData = addDrawerCase.value
  if (!caseData) return false

  const col = addDrawerColumn.value
  const row = addDrawerRow.value
  const widthUnits = addDrawerWidth.value
  const heightUnits = addDrawerHeight.value

  // Check bounds
  if (widthUnits < 1 || heightUnits < 1) return false
  if (col + widthUnits - 1 > caseData.internalColumns) return false
  if (row + heightUnits - 1 > caseData.internalRows) return false

  // Check for collisions with existing drawers
  if (caseData.drawers) {
    for (const drawer of caseData.drawers) {
      const drawerWidth = drawer.widthUnits ?? 1
      const drawerHeight = drawer.heightUnits ?? 1

      // AABB collision detection
      const xOverlap = col < drawer.gridColumn + drawerWidth &&
                       col + widthUnits > drawer.gridColumn
      const yOverlap = row < drawer.gridRow + drawerHeight &&
                       row + heightUnits > drawer.gridRow

      if (xOverlap && yOverlap) return false
    }
  }

  return true
})

// Get validation message for drawer size
const drawerSizeValidationMessage = computed(() => {
  const caseData = addDrawerCase.value
  if (!caseData) return ''

  const col = addDrawerColumn.value
  const row = addDrawerRow.value
  const widthUnits = addDrawerWidth.value
  const heightUnits = addDrawerHeight.value

  if (widthUnits < 1 || heightUnits < 1) {
    return 'Dimensions must be at least 1x1'
  }

  // Check bounds
  if (col + widthUnits - 1 > caseData.internalColumns) {
    return 'Exceeds case width'
  }
  if (row + heightUnits - 1 > caseData.internalRows) {
    return 'Exceeds case height'
  }

  // Check for collisions
  if (caseData.drawers) {
    for (const drawer of caseData.drawers) {
      const drawerWidth = drawer.widthUnits ?? 1
      const drawerHeight = drawer.heightUnits ?? 1

      const xOverlap = col < drawer.gridColumn + drawerWidth &&
                       col + widthUnits > drawer.gridColumn
      const yOverlap = row < drawer.gridRow + drawerHeight &&
                       row + heightUnits > drawer.gridRow

      if (xOverlap && yOverlap) return 'Overlaps existing drawer'
    }
  }

  return ''
})

// Max allowed dimensions for new drawer
const maxDrawerWidth = computed(() => {
  const caseData = addDrawerCase.value
  if (!caseData) return 1
  return caseData.internalColumns - addDrawerColumn.value + 1
})

const maxDrawerHeight = computed(() => {
  const caseData = addDrawerCase.value
  if (!caseData) return 1
  return caseData.internalRows - addDrawerRow.value + 1
})

// Edit case functions
function handleEditCase(caseId: number) {
  const caseData = cases.value.find(c => c.id === caseId)
  if (caseData) {
    editingCaseData.value = caseData
    isEditingCase.value = true
  }
}

function closeEditCaseModal() {
  isEditingCase.value = false
  editingCaseData.value = null
}

async function handleCaseUpdated(updatedCase: Case) {
  // Update the case in the wall store locally
  wallStore.updateCaseInWall(updatedCase)
}

async function handleCaseDeleted(caseId: number) {
  // Remove the case from the wall store locally
  wallStore.removeCaseFromWall(caseId)
}

async function handleCaseMove(caseId: number, newColumn: number, newRow: number) {
  markLocalMutation() // Mark before API call so SSE events are ignored
  try {
    const updatedCase = await caseService.updateCasePosition(caseId, {
      gridColumnStart: newColumn,
      gridRowStart: newRow
    })
    // Update locally instead of refreshing wall
    wallStore.updateCaseInWall(updatedCase)
  } catch (e) {
    console.error('Failed to move case:', e)
  }
}

async function handleCaseResize(caseId: number, newColumnSpan: number, newRowSpan: number) {
  markLocalMutation() // Mark before API call so SSE events are ignored
  try {
    const updatedCase = await caseService.updateCasePosition(caseId, {
      gridColumnSpan: newColumnSpan,
      gridRowSpan: newRowSpan
    })
    // Update locally instead of refreshing wall
    wallStore.updateCaseInWall(updatedCase)
  } catch (e) {
    console.error('Failed to resize case:', e)
  }
}
</script>

<template>
  <div ref="wallViewRef" class="wall-view">
    <!-- Search results overlay -->
    <SearchResults
      v-if="searchStore.isActive"
      :results="searchStore.results"
      :is-searching="searchStore.isSearching"
      @highlight="handleHighlightDrawer"
    />

    <!-- Main wall content -->
    <template v-else>
      <div v-if="wallStore.loading" class="loading-state">
        Loading storage wall...
      </div>

      <StorageWall
        v-else-if="wallStore.currentWall"
        :cases="cases"
        :grid-columns="wallStore.currentWall.gridColumns"
        @drawer-click="handleDrawerClick"
        @add-drawer="handleAddDrawer"
        @edit-case="handleEditCase"
        @case-move="handleCaseMove"
        @case-resize="handleCaseResize"
      />

      <div v-else class="empty-state">
        <p>No storage wall found.</p>
        <BaseButton @click="wallStore.createWall({ name: 'My Storage Wall' })">
          Create Wall
        </BaseButton>
      </div>
    </template>

    <!-- Drawer modal -->
    <DrawerOpen
      :open="openDrawerId !== null"
      :drawer-id="openDrawerId"
      @close="closeDrawer"
    />

    <!-- Add case modal -->
    <BaseModal
      :open="wallStore.showAddCaseModal"
      title="Add Storage Case"
      @close="wallStore.closeAddCaseModal()"
    >
      <div class="add-case-form">
        <BaseInput
          v-model="newCaseName"
          label="Case Name"
          placeholder="Enter case name..."
        />

        <div class="position-section">
          <label class="section-label">Grid Position</label>
          <div class="position-grid">
            <div class="position-field">
              <label>Column</label>
              <input
                type="number"
                v-model.number="newCaseColumnStart"
                :min="1"
                :max="gridColumns - newCaseColumnSpan + 1"
              />
            </div>
            <div class="position-field">
              <label>Row</label>
              <input
                type="number"
                v-model.number="newCaseRowStart"
                :min="1"
              />
            </div>
            <div class="position-field">
              <label>Width</label>
              <input
                type="number"
                v-model.number="newCaseColumnSpan"
                :min="1"
                :max="gridColumns"
              />
            </div>
            <div class="position-field">
              <label>Height</label>
              <input
                type="number"
                v-model.number="newCaseRowSpan"
                :min="1"
                :max="10"
              />
            </div>
          </div>
          <p class="position-hint">
            Position: Column {{ newCaseColumnStart }}-{{ newCaseColumnStart + newCaseColumnSpan - 1 }},
            Row {{ newCaseRowStart }}-{{ newCaseRowStart + newCaseRowSpan - 1 }}
          </p>
        </div>

        <div class="template-section">
          <label class="section-label">Layout Template</label>
          <div class="template-grid">
            <button
              class="template-option"
              :class="{ selected: selectedTemplate === null }"
              @click="selectedTemplate = null"
            >
              <span class="template-name">Empty</span>
              <span class="template-desc">Start with an empty case</span>
            </button>
            <button
              v-for="template in templates"
              :key="template.id"
              class="template-option"
              :class="{ selected: selectedTemplate === template.id }"
              @click="selectedTemplate = template.id"
            >
              <span class="template-name">{{ template.name }}</span>
              <span class="template-desc">{{ template.description }}</span>
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="wallStore.closeAddCaseModal()">
          Cancel
        </BaseButton>
        <BaseButton @click="addCase" :loading="loading">
          Create Case
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Add drawer modal -->
    <BaseModal
      :open="isAddingDrawer"
      title="Add Drawer"
      @close="closeAddDrawerModal"
    >
      <div class="add-drawer-form">
        <p class="drawer-location-info">
          Adding drawer to <strong>{{ addDrawerCaseName }}</strong> at position ({{ addDrawerColumn }}, {{ addDrawerRow }})
        </p>

        <BaseInput
          v-model="addDrawerName"
          label="Drawer Name (optional)"
          placeholder="Enter drawer name..."
        />

        <div class="size-section">
          <label class="section-label">Drawer Size</label>
          <div class="dimension-inputs">
            <div class="dimension-field">
              <label>Width</label>
              <input
                type="number"
                v-model.number="addDrawerWidth"
                :min="1"
                :max="maxDrawerWidth"
              />
            </div>
            <span class="dimension-separator">x</span>
            <div class="dimension-field">
              <label>Height</label>
              <input
                type="number"
                v-model.number="addDrawerHeight"
                :min="1"
                :max="maxDrawerHeight"
              />
            </div>
          </div>
          <p v-if="drawerSizeValidationMessage" class="validation-error">
            {{ drawerSizeValidationMessage }}
          </p>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="closeAddDrawerModal">
          Cancel
        </BaseButton>
        <BaseButton
          @click="createDrawer"
          :loading="addDrawerLoading"
          :disabled="!isDrawerSizeValid"
        >
          Create Drawer
        </BaseButton>
      </template>
    </BaseModal>

    <!-- Case properties modal -->
    <CasePropertiesModal
      :open="isEditingCase"
      :case-data="editingCaseData"
      :wall-grid-columns="gridColumns"
      @close="closeEditCaseModal"
      @updated="handleCaseUpdated"
      @deleted="handleCaseDeleted"
    />
  </div>
</template>

<style scoped>
.wall-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  color: var(--color-text-muted);
}

.add-case-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.section-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}

.position-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
}

.position-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.position-field label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.position-field input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  width: 100%;
}

.position-field input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.position-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.template-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.template-option {
  padding: var(--spacing-md);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  text-align: left;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.template-option:hover {
  border-color: var(--color-primary);
}

.template-option.selected {
  border-color: var(--color-primary);
  background: rgba(52, 152, 219, 0.1);
}

.template-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.template-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Add drawer modal styles */
.add-drawer-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.drawer-location-info {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.drawer-location-info strong {
  color: var(--color-text);
}

.size-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.dimension-inputs {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
}

.dimension-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.dimension-field label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.dimension-field input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  width: 100%;
  text-align: center;
}

.dimension-field input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.dimension-separator {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  padding-bottom: var(--spacing-sm);
}

.validation-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  margin: 0;
}
</style>
