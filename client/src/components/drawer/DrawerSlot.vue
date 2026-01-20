<script setup lang="ts">
import { computed } from 'vue'
import type { Drawer } from '@/types'
import DrawerFront from './DrawerFront.vue'
import { useDragDrop } from '@/composables/useDragDrop'

interface Props {
  drawer?: Drawer
  caseId: number
  column: number
  row: number
  highlighted?: boolean
  isCovered?: boolean
  caseColumns?: number
  caseRows?: number
  caseColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  highlighted: false,
  isCovered: false,
  caseColumns: 4,
  caseRows: 6,
  caseColor: '#8B7355'
})

const emit = defineEmits<{
  click: []
  'add-drawer': [column: number, row: number]
}>()

const {
  isDragging,
  dragData,
  isValidTarget,
  isDragOver,
  setDragOver,
  clearDragOver,
  handleDrop
} = useDragDrop()

const slotStyle = computed(() => {
  if (!props.drawer?.drawerSize) {
    return {
      '--drawer-col': props.column,
      '--drawer-col-span': 1,
      '--drawer-row': props.row,
      '--drawer-row-span': 1
    }
  }

  return {
    '--drawer-col': props.drawer.gridColumn,
    '--drawer-col-span': props.drawer.drawerSize.widthUnits,
    '--drawer-row': props.drawer.gridRow,
    '--drawer-row-span': props.drawer.drawerSize.heightUnits
  }
})

// Only render if this is the origin cell of a drawer or a truly empty slot (not covered by spanning drawer)
const shouldRender = computed(() => {
  if (!props.drawer) {
    // If no drawer at this origin, only render if slot is not covered by a spanning drawer
    return !props.isCovered
  }
  return props.drawer.gridColumn === props.column && props.drawer.gridRow === props.row
})

// Check if this slot is a valid drop target
const isValidDropTarget = computed(() => {
  // Don't show as valid target if there's already a drawer here
  if (props.drawer) return false
  return isValidTarget(props.caseId, props.column, props.row)
})

// Check if this is the current drag-over target
const isCurrentDragOver = computed(() => {
  return isDragOver(props.caseId, props.column, props.row)
})

// Check if slot is invalid target while dragging (show red highlight)
const isInvalidTarget = computed(() => {
  if (!isDragging.value) return false
  if (props.drawer) return false // Occupied slots don't show invalid state
  if (props.isCovered) return false // Covered slots don't show invalid state
  return !isValidTarget(props.caseId, props.column, props.row)
})

// Get the size info of the dragged drawer for display
const draggedDrawerSize = computed(() => {
  if (!dragData.value?.size) return { width: 1, height: 1 }
  return {
    width: dragData.value.size.widthUnits,
    height: dragData.value.size.heightUnits
  }
})

// Show the drawer extent indicator when hovering over a valid drop target
const showDrawerExtent = computed(() => {
  return isCurrentDragOver.value && isValidDropTarget.value && dragData.value?.size
})

// Calculate how the drawer would span from this position
const drawerExtentStyle = computed(() => {
  if (!showDrawerExtent.value) return {}
  const width = draggedDrawerSize.value.width
  const height = draggedDrawerSize.value.height
  return {
    '--extent-width': width,
    '--extent-height': height
  }
})

function handleClick() {
  if (props.drawer) {
    emit('click')
  } else {
    emit('add-drawer', props.column, props.row)
  }
}

// Drag event handlers for drop zone
function handleDragOver(event: DragEvent) {
  if (isValidDropTarget.value) {
    event.preventDefault()
    event.dataTransfer!.dropEffect = 'move'
  }
}

function handleDragEnter(event: DragEvent) {
  if (isValidDropTarget.value) {
    event.preventDefault()
    setDragOver(props.caseId, props.column, props.row)
  }
}

function handleDragLeave() {
  clearDragOver()
}

async function handleDropEvent(event: DragEvent) {
  event.preventDefault()
  if (isValidDropTarget.value) {
    await handleDrop(props.caseId, props.column, props.row)
  }
}
</script>

<template>
  <div
    v-if="shouldRender"
    class="drawer-slot"
    :class="{
      'is-valid-target': isValidDropTarget,
      'is-drag-over': isCurrentDragOver,
      'is-invalid-target': isInvalidTarget,
      'is-dragging-active': isDragging,
      'show-extent': showDrawerExtent
    }"
    :style="{ ...slotStyle, ...drawerExtentStyle }"
    @click="handleClick"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDropEvent"
  >
    <DrawerFront
      v-if="drawer"
      :drawer="drawer"
      :highlighted="highlighted"
      :case-color="caseColor"
    />
    <div v-else class="skeu-empty-slot">
      <span v-if="!isDragging">+</span>
      <span v-else-if="isValidDropTarget" class="drop-indicator">
        {{ draggedDrawerSize.width > 1 || draggedDrawerSize.height > 1
          ? `${draggedDrawerSize.width}x${draggedDrawerSize.height}`
          : 'Drop here' }}
      </span>
    </div>
    <!-- Visual indicator showing where the drawer will span -->
    <div v-if="showDrawerExtent" class="drawer-extent-preview"></div>
  </div>
</template>

<style scoped>
.drawer-slot {
  grid-column: var(--drawer-col) / span var(--drawer-col-span);
  grid-row: var(--drawer-row) / span var(--drawer-row-span);
  min-height: 40px;
  position: relative;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

/* Valid drop target styling */
.drawer-slot.is-valid-target {
  border-color: var(--color-success);
  background: rgba(39, 174, 96, 0.1);
}

.drawer-slot.is-valid-target .skeu-empty-slot {
  opacity: 1;
  border-color: var(--color-success);
  background: rgba(39, 174, 96, 0.15);
}

/* Drag over (hovering) styling */
.drawer-slot.is-drag-over {
  border-color: var(--color-primary);
  background: rgba(52, 152, 219, 0.2);
  transform: scale(1.02);
}

.drawer-slot.is-drag-over .skeu-empty-slot {
  background: rgba(52, 152, 219, 0.25);
  border-style: solid;
}

/* Invalid drop target styling (while dragging) */
.drawer-slot.is-invalid-target .skeu-empty-slot {
  opacity: 0.4;
  border-color: var(--color-danger);
  background: rgba(231, 76, 60, 0.05);
}

/* Default empty slot styling */
.skeu-empty-slot {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  opacity: 0;
  transition: all var(--transition-fast);
  cursor: pointer;
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.05);
}

.drawer-slot:hover .skeu-empty-slot {
  opacity: 0.5;
}

/* Show empty slots during drag */
.drawer-slot.is-dragging-active .skeu-empty-slot {
  opacity: 1;
}

/* Drop indicator text */
.drop-indicator {
  font-size: var(--font-size-xs);
  color: var(--color-success);
  font-weight: 600;
}

.drawer-slot.is-drag-over .drop-indicator {
  color: var(--color-primary);
}

/* Drawer extent preview - shows where a multi-cell drawer will span */
.drawer-extent-preview {
  position: absolute;
  top: 0;
  left: 0;
  /* Use CSS calc with grid gap to show full extent */
  width: calc((100% + 3px) * var(--extent-width, 1) - 3px);
  height: calc((100% + 3px) * var(--extent-height, 1) - 3px);
  border: 3px dashed var(--color-primary);
  border-radius: var(--radius-md);
  background: rgba(52, 152, 219, 0.15);
  pointer-events: none;
  z-index: 10;
  animation: pulse-extent 1s ease-in-out infinite;
}

@keyframes pulse-extent {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* When showing extent, hide the standard drag-over styling on the slot itself */
.drawer-slot.show-extent.is-drag-over {
  border-color: transparent;
  background: transparent;
}

.drawer-slot.show-extent .skeu-empty-slot {
  z-index: 11;
  position: relative;
}
</style>
