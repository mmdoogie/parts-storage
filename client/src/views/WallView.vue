<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useWallStore, useDrawerStore, useCategoryStore, useSearchStore, useCaseStore } from '@/stores'
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
const caseStore = useCaseStore()

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
const addDrawerSizeId = ref<number | null>(null)
const addDrawerName = ref('')
const addDrawerLoading = ref(false)

// Edit case state
const isEditingCase = ref(false)
const editingCaseData = ref<Case | null>(null)

// SSE connection for real-time updates
let eventSource: EventSource | null = null
let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
const REFRESH_DEBOUNCE = 500 // Wait for events to settle before refreshing

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

// Refresh wall data when tab regains focus (fallback for SSE)
let lastFocusRefresh = Date.now()
const FOCUS_REFRESH_INTERVAL = 5000 // Don't refresh more than once every 5 seconds

function handleWindowFocus() {
  const now = Date.now()
  if (now - lastFocusRefresh > FOCUS_REFRESH_INTERVAL && wallStore.currentWall) {
    lastFocusRefresh = now
    refreshWall()
  }
}

onMounted(async () => {
  await wallStore.fetchWalls()
  if (wallStore.walls.length > 0) {
    await wallStore.fetchWall(wallStore.walls[0].id)
  }
  await drawerStore.fetchDrawerSizes()
  await categoryStore.fetchCategories()
  templates.value = await caseService.getLayoutTemplates()

  // Setup SSE for real-time updates
  setupSSE()

  // Add focus listener as fallback
  window.addEventListener('focus', handleWindowFocus)
})

onUnmounted(() => {
  cleanupSSE()
  window.removeEventListener('focus', handleWindowFocus)
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
  openDrawerId.value = null
  drawerStore.setOpenDrawer(null)
  // Refresh wall to get updated drawer info
  refreshWall()
}

async function addCase() {
  if (!wallStore.currentWall) return

  loading.value = true
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
    }

    // Refresh wall
    await refreshWall()

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
  addDrawerName.value = ''
  isAddingDrawer.value = true

  // Find the first valid drawer size, or default to the first one
  const validSize = drawerStore.drawerSizes.find(size => {
    const caseData = cases.value.find(c => c.id === caseId)
    if (!caseData) return false

    // Check bounds
    if (column + size.widthUnits - 1 > caseData.internalColumns) return false
    if (row + size.heightUnits - 1 > caseData.internalRows) return false

    // Check collisions
    if (caseData.drawers) {
      for (const drawer of caseData.drawers) {
        const drawerWidth = drawer.drawerSize?.widthUnits ?? 1
        const drawerHeight = drawer.drawerSize?.heightUnits ?? 1

        const xOverlap = column < drawer.gridColumn + drawerWidth &&
                         column + size.widthUnits > drawer.gridColumn
        const yOverlap = row < drawer.gridRow + drawerHeight &&
                         row + size.heightUnits > drawer.gridRow

        if (xOverlap && yOverlap) return false
      }
    }
    return true
  })

  addDrawerSizeId.value = validSize?.id || null
}

function closeAddDrawerModal() {
  isAddingDrawer.value = false
  addDrawerCaseId.value = null
  addDrawerSizeId.value = null
  addDrawerName.value = ''
}

async function createDrawer() {
  if (!addDrawerCaseId.value || !addDrawerSizeId.value) return

  addDrawerLoading.value = true
  try {
    const newDrawer = await drawerStore.createDrawer({
      caseId: addDrawerCaseId.value,
      drawerSizeId: addDrawerSizeId.value,
      gridColumn: addDrawerColumn.value,
      gridRow: addDrawerRow.value,
      name: addDrawerName.value.trim() || undefined
    })

    // Refresh wall to get updated case with new drawer
    await refreshWall()

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

// Check if a drawer size is valid at the selected position
function isDrawerSizeValid(sizeId: number): boolean {
  const caseData = addDrawerCase.value
  if (!caseData) return false

  const size = drawerStore.drawerSizes.find(s => s.id === sizeId)
  if (!size) return false

  const col = addDrawerColumn.value
  const row = addDrawerRow.value
  const widthUnits = size.widthUnits
  const heightUnits = size.heightUnits

  // Check bounds
  if (col + widthUnits - 1 > caseData.internalColumns) return false
  if (row + heightUnits - 1 > caseData.internalRows) return false

  // Check for collisions with existing drawers
  if (caseData.drawers) {
    for (const drawer of caseData.drawers) {
      const drawerWidth = drawer.drawerSize?.widthUnits ?? 1
      const drawerHeight = drawer.drawerSize?.heightUnits ?? 1

      // AABB collision detection
      const xOverlap = col < drawer.gridColumn + drawerWidth &&
                       col + widthUnits > drawer.gridColumn
      const yOverlap = row < drawer.gridRow + drawerHeight &&
                       row + heightUnits > drawer.gridRow

      if (xOverlap && yOverlap) return false
    }
  }

  return true
}

// Get validation message for a drawer size
function getDrawerSizeValidationMessage(sizeId: number): string {
  const caseData = addDrawerCase.value
  if (!caseData) return ''

  const size = drawerStore.drawerSizes.find(s => s.id === sizeId)
  if (!size) return ''

  const col = addDrawerColumn.value
  const row = addDrawerRow.value
  const widthUnits = size.widthUnits
  const heightUnits = size.heightUnits

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
      const drawerWidth = drawer.drawerSize?.widthUnits ?? 1
      const drawerHeight = drawer.drawerSize?.heightUnits ?? 1

      const xOverlap = col < drawer.gridColumn + drawerWidth &&
                       col + widthUnits > drawer.gridColumn
      const yOverlap = row < drawer.gridRow + drawerHeight &&
                       row + heightUnits > drawer.gridRow

      if (xOverlap && yOverlap) return 'Overlaps existing drawer'
    }
  }

  return ''
}

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
  // Update the case in the wall store
  wallStore.updateCaseInWall(updatedCase)
  // Refresh the wall to get the complete updated data
  await refreshWall()
}

async function handleCaseDeleted(caseId: number) {
  // Remove the case from the wall store
  wallStore.removeCaseFromWall(caseId)
  // Refresh the wall to get the updated data
  await refreshWall()
}

async function handleCaseMove(caseId: number, newColumn: number, newRow: number) {
  try {
    await caseService.updateCasePosition(caseId, {
      gridColumnStart: newColumn,
      gridRowStart: newRow
    })
    // Refresh the wall to get the updated positions
    await refreshWall()
  } catch (e) {
    console.error('Failed to move case:', e)
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
      @select="handleDrawerClick"
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
          <div class="size-grid">
            <button
              v-for="size in drawerStore.drawerSizes"
              :key="size.id"
              class="size-option"
              :class="{
                selected: addDrawerSizeId === size.id,
                disabled: !isDrawerSizeValid(size.id)
              }"
              :disabled="!isDrawerSizeValid(size.id)"
              :title="getDrawerSizeValidationMessage(size.id)"
              @click="isDrawerSizeValid(size.id) && (addDrawerSizeId = size.id)"
            >
              <span class="size-name">{{ size.name }}</span>
              <span class="size-desc">{{ size.widthUnits }}x{{ size.heightUnits }}</span>
              <span v-if="!isDrawerSizeValid(size.id)" class="size-invalid">
                {{ getDrawerSizeValidationMessage(size.id) }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="closeAddDrawerModal">
          Cancel
        </BaseButton>
        <BaseButton
          @click="createDrawer"
          :loading="addDrawerLoading"
          :disabled="!addDrawerSizeId || !isDrawerSizeValid(addDrawerSizeId)"
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

.size-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--spacing-sm);
}

.size-option {
  padding: var(--spacing-md);
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-md);
  text-align: center;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  cursor: pointer;
  background: white;
}

.size-option:hover {
  border-color: var(--color-primary);
}

.size-option.selected {
  border-color: var(--color-primary);
  background: rgba(52, 152, 219, 0.1);
}

.size-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  text-transform: capitalize;
}

.size-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.size-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: rgba(231, 76, 60, 0.3);
  background: rgba(231, 76, 60, 0.05);
}

.size-option.disabled:hover {
  border-color: rgba(231, 76, 60, 0.3);
  transform: none;
}

.size-invalid {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  font-weight: 500;
}
</style>
