<script setup lang="ts">
import { computed } from 'vue'
import type { Case } from '@/types'
import { useSearchStore } from '@/stores'
import StorageCase from '@/components/case/StorageCase.vue'

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
}>()

const searchStore = useSearchStore()

// Calculate the maximum row used by cases to size the grid
const maxRow = computed(() => {
  if (!props.cases.length) return 2
  return Math.max(...props.cases.map(c => c.gridRowStart + c.gridRowSpan - 1)) + 1
})

const gridStyle = computed(() => ({
  '--wall-columns': props.gridColumns,
  '--wall-rows': maxRow.value
}))
</script>

<template>
  <div class="storage-wall" :style="gridStyle">
    <StorageCase
      v-for="caseData in cases"
      :key="caseData.id"
      :case-data="caseData"
      :highlighted-drawer-ids="searchStore.highlightedDrawerIds"
      @click="emit('case-click', caseData)"
      @drawer-click="emit('drawer-click', $event)"
      @add-drawer="(caseId, col, row) => emit('add-drawer', caseId, col, row)"
      @edit-case="emit('edit-case', $event)"
    />

    <div v-if="!cases.length" class="wall-empty">
      <p>No storage cases yet.</p>
      <p class="wall-empty-hint">Add a case to get started!</p>
    </div>
  </div>
</template>

<style scoped>
.storage-wall {
  display: grid;
  grid-template-columns: repeat(var(--wall-columns, 12), 1fr);
  grid-auto-rows: minmax(80px, auto);
  gap: var(--wall-gap, 16px);
  padding: var(--wall-padding, 24px);
  min-height: 400px;
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
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .storage-wall {
    grid-template-columns: repeat(6, 1fr);
  }
}
</style>
