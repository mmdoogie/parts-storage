<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Case, Drawer } from '@/types'
import DrawerSlot from '@/components/drawer/DrawerSlot.vue'

interface Props {
  caseData: Case
  highlightedDrawerIds?: Set<number>
  locked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  highlightedDrawerIds: () => new Set(),
  locked: false
})

const emit = defineEmits<{
  'drawer-click': [drawerId: number]
  'add-drawer': [caseId: number, column: number, row: number]
  'edit-case': [caseId: number]
  'case-drag-start': [caseId: number, event: DragEvent]
  'case-drag-end': []
  'resize-start': [caseId: number, event: MouseEvent]
}>()


function handleCaseDragStart(event: DragEvent) {
  const dragPayload = JSON.stringify({
    type: 'case',
    id: props.caseData.id,
    columnSpan: props.caseData.gridColumnSpan,
    rowSpan: props.caseData.gridRowSpan
  })

  event.dataTransfer!.effectAllowed = 'move'
  event.dataTransfer!.setData('text/plain', dragPayload)
  event.dataTransfer!.setData('application/json', dragPayload)

  // Emit after a microtask to avoid re-render during dragstart
  setTimeout(() => {
    emit('case-drag-start', props.caseData.id, event)
  }, 0)
}

function handleCaseDragEnd() {
  emit('case-drag-end')
}

const caseStyle = computed(() => ({
  '--case-col-start': props.caseData.gridColumnStart,
  '--case-col-span': props.caseData.gridColumnSpan,
  '--case-row-start': props.caseData.gridRowStart,
  '--case-row-span': props.caseData.gridRowSpan,
  '--case-columns': props.caseData.internalColumns,
  '--case-rows': props.caseData.internalRows,
  '--case-color': props.caseData.color
}))

// Create a map of drawers by their grid position
const drawerMap = computed(() => {
  const map = new Map<string, Drawer>()
  if (props.caseData.drawers) {
    for (const drawer of props.caseData.drawers) {
      map.set(`${drawer.gridColumn}-${drawer.gridRow}`, drawer)
    }
  }
  return map
})

// Create a set of all slots that are covered by any drawer (including spanning drawers)
const coveredSlots = computed(() => {
  const covered = new Set<string>()
  if (props.caseData.drawers) {
    for (const drawer of props.caseData.drawers) {
      const widthUnits = drawer.drawerSize?.widthUnits ?? 1
      const heightUnits = drawer.drawerSize?.heightUnits ?? 1
      for (let c = 0; c < widthUnits; c++) {
        for (let r = 0; r < heightUnits; r++) {
          covered.add(`${drawer.gridColumn + c}-${drawer.gridRow + r}`)
        }
      }
    }
  }
  return covered
})

function getDrawerAt(col: number, row: number): Drawer | undefined {
  return drawerMap.value.get(`${col}-${row}`)
}

function isSlotCovered(col: number, row: number): boolean {
  return coveredSlots.value.has(`${col}-${row}`)
}

function isHighlighted(drawerId: number): boolean {
  return props.highlightedDrawerIds.has(drawerId)
}

function handleResizeStart(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('resize-start', props.caseData.id, event)
}
</script>

<template>
  <div
    class="storage-case skeu-case"
    :style="caseStyle"
  >
    <header
      class="case-header"
      :class="{ 'is-locked': locked }"
      :draggable="!locked"
      @dragstart="handleCaseDragStart"
      @dragend="handleCaseDragEnd"
    >
      <h3 class="case-title">{{ caseData.name }}</h3>
      <button
        v-if="!locked"
        class="case-settings-btn"
        @click.stop="emit('edit-case', caseData.id)"
        @mousedown.stop
        title="Case settings"
        aria-label="Edit case settings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
    <div class="case-grid skeu-case-inner">
      <template v-for="row in caseData.internalRows" :key="row">
        <template v-for="col in caseData.internalColumns" :key="`${row}-${col}`">
          <DrawerSlot
            :drawer="getDrawerAt(col, row)"
            :case-id="caseData.id"
            :column="col"
            :row="row"
            :highlighted="getDrawerAt(col, row) ? isHighlighted(getDrawerAt(col, row)!.id) : false"
            :is-covered="isSlotCovered(col, row)"
            :case-color="caseData.color"
            :locked="locked"
            @click="getDrawerAt(col, row) && emit('drawer-click', getDrawerAt(col, row)!.id)"
            @add-drawer="(column, row) => emit('add-drawer', caseData.id, column, row)"
          />
        </template>
      </template>
    </div>
    <!-- Resize handle -->
    <div
      v-if="!locked"
      class="resize-handle"
      @mousedown="handleResizeStart"
      title="Drag to resize"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z"/>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.storage-case {
  grid-column: var(--case-col-start) / span var(--case-col-span);
  grid-row: var(--case-row-start) / span var(--case-row-span);
  display: flex;
  flex-direction: column;
  min-height: 0; /* Allow case to fit within wall grid constraints */
  overflow: hidden;
  position: relative;
}

.resize-handle {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  color: rgba(255, 255, 255, 0.4);
  transition: color var(--transition-fast);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize-handle:hover {
  color: rgba(255, 255, 255, 0.8);
}

.resize-handle svg {
  width: 14px;
  height: 14px;
}


.case-header {
  padding: var(--spacing-xs) var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  cursor: grab;
}

.case-header.is-locked {
  cursor: default;
}

.case-header:active:not(.is-locked) {
  cursor: grabbing;
}

.case-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.case-settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  opacity: 0.7;
}

.case-settings-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  opacity: 1;
}

.case-settings-btn:active {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0.95);
}

.case-settings-btn svg {
  width: 14px;
  height: 14px;
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(var(--case-columns), 1fr);
  grid-template-rows: repeat(var(--case-rows), 1fr);
  gap: 3px;
  flex: 1;
  min-height: 0; /* Allow grid to shrink below content size */
  padding: var(--spacing-xs);
  overflow: hidden;
}

/* Responsive adjustments */
@media (max-width: 767px) {
  .storage-case {
    grid-column: 1 / -1 !important;
    grid-row: auto !important;
    /* On mobile, give case a minimum height based on internal rows */
    min-height: calc(var(--case-rows) * 50px + var(--spacing-lg));
  }

  .case-grid {
    /* On mobile, use a minimum row height since we're not constrained by wall grid */
    grid-template-rows: repeat(var(--case-rows), minmax(40px, 1fr));
  }
}
</style>
