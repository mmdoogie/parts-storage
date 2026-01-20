<script setup lang="ts">
import { computed } from 'vue'
import type { Drawer, DragData } from '@/types'
import { useDragDrop } from '@/composables/useDragDrop'

interface Props {
  drawer: Drawer
  highlighted?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  highlighted: false
})

const { startDrag, endDrag, isDragging, dragData } = useDragDrop()

const isEmpty = computed(() => !props.drawer.parts?.length && !props.drawer.name)

const displayName = computed(() => {
  if (props.drawer.name) return props.drawer.name
  if (props.drawer.parts?.length === 1) return props.drawer.parts[0].name
  if (props.drawer.parts?.length) return `${props.drawer.parts.length} items`
  return ''
})

const drawerStyle = computed(() => ({
  '--drawer-color': props.drawer.color
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
    size: props.drawer.drawerSize
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
  min-height: 40px;
  position: relative;
}

.drawer-front.is-dragging {
  opacity: 0.4;
}

.skeu-category-dot {
  background: var(--category-color);
}
</style>
