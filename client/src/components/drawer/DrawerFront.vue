<script setup lang="ts">
import { computed } from 'vue'
import type { Drawer, DragData } from '@/types'
import { useDragDrop } from '@/composables/useDragDrop'

interface Props {
  drawer: Drawer
  highlighted?: boolean
  caseColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  highlighted: false,
  caseColor: '#8B7355'
})

const { startDrag, endDrag, isDragging, dragData } = useDragDrop()

const isEmpty = computed(() => !props.drawer.parts?.length && !props.drawer.name)

const displayName = computed(() => {
  if (props.drawer.name) return props.drawer.name
  if (props.drawer.parts?.length === 1) return props.drawer.parts[0].name
  if (props.drawer.parts?.length) return `${props.drawer.parts.length} items`
  return ''
})

// Convert hex color to HSL for manipulation
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 50 }

  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

// Create a lightened version of the case color for drawer fronts
const lightenedCaseColor = computed(() => {
  const hsl = hexToHsl(props.caseColor)
  // Increase lightness by 30-40% and reduce saturation slightly for a softer look
  const newL = Math.min(90, hsl.l + 35)
  const newS = Math.max(20, hsl.s * 0.7)
  return `hsl(${hsl.h}, ${newS}%, ${newL}%)`
})

const drawerHighlight = computed(() => {
  const hsl = hexToHsl(props.caseColor)
  const newL = Math.min(95, hsl.l + 45)
  const newS = Math.max(15, hsl.s * 0.5)
  return `hsl(${hsl.h}, ${newS}%, ${newL}%)`
})

const drawerShadow = computed(() => {
  const hsl = hexToHsl(props.caseColor)
  const newL = Math.min(80, hsl.l + 20)
  const newS = Math.max(25, hsl.s * 0.8)
  return `hsl(${hsl.h}, ${newS}%, ${newL}%)`
})

// Scale pull handle based on drawer size
const pullDimensions = computed(() => {
  const widthUnits = props.drawer.widthUnits ?? 1

  // Base width for a 1x1 drawer, scales with drawer width
  const baseWidth = 20
  const pullWidth = Math.min(baseWidth + (widthUnits - 1) * 12, 60)

  return {
    width: `${pullWidth}px`,
    height: '12px',
    radius: '3px'
  }
})

const drawerStyle = computed(() => ({
  '--drawer-color': props.drawer.color,
  '--drawer-base': lightenedCaseColor.value,
  '--drawer-highlight': drawerHighlight.value,
  '--drawer-shadow': drawerShadow.value,
  '--pull-width': pullDimensions.value.width,
  '--pull-height': pullDimensions.value.height,
  '--pull-radius': pullDimensions.value.radius
}))

// Aggregate categories from all parts in the drawer
const categories = computed(() => {
  return props.drawer.categories || []
})

// Check if this drawer is currently being dragged
const isBeingDragged = computed(() => {
  return isDragging.value && dragData.value?.id === props.drawer.id
})

// Handle drag start
function handleDragStart(event: DragEvent) {
  // Stop propagation to prevent any parent draggable from capturing this event
  event.stopPropagation()

  const data: DragData = {
    type: 'drawer',
    id: props.drawer.id,
    sourceCase: props.drawer.caseId,
    widthUnits: props.drawer.widthUnits,
    heightUnits: props.drawer.heightUnits
  }
  startDrag(data, event)
}

// Handle drag end
function handleDragEnd() {
  endDrag()
}
</script>

<template>
  <div
    class="drawer-front skeu-drawer"
    :class="{
      'is-empty': isEmpty,
      'search-match': highlighted,
      'is-dragging': isBeingDragged
    }"
    :style="drawerStyle"
    :data-drawer-id="drawer.id"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <!-- Category dots -->
    <div v-if="categories.length" class="skeu-category-dots">
      <span
        v-for="cat in categories.slice(0, 5)"
        :key="cat.id"
        class="skeu-category-dot"
        :style="{ '--category-color': cat.color }"
        :title="cat.name"
      />
    </div>

    <!-- Drawer pull handle -->
    <div class="skeu-pull" />

    <!-- Drawer label -->
    <div v-if="displayName" class="skeu-drawer-label" :title="displayName">
      {{ displayName }}
    </div>
  </div>
</template>

<style scoped>
.drawer-front {
  height: 100%;
  min-height: 0; /* Allow drawer to shrink to fit within case */
  position: relative;
}

.drawer-front.is-dragging {
  opacity: 0.4;
}

.skeu-category-dot {
  background: var(--category-color);
}
</style>
