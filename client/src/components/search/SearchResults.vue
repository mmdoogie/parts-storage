<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { SearchResult } from '@/types'
import { useSearchStore } from '@/stores'

interface Props {
  results: SearchResult[]
  isSearching: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  highlight: [drawerId: number, wallId: number]
}>()

const searchStore = useSearchStore()
const resultsListRef = ref<HTMLElement | null>(null)
const showNumbers = ref(false)

function getResultIcon(type: string) {
  switch (type) {
    case 'part': return 'P'
    case 'drawer': return 'D'
    case 'case': return 'C'
    default: return '?'
  }
}

function handleHighlight(event: Event | null, drawerId: number, wallId: number) {
  event?.stopPropagation()
  searchStore.clearSearch()
  emit('highlight', drawerId, wallId)
}

function triggerHighlightByIndex(index: number) {
  const result = props.results[index]
  if (result) {
    handleHighlight(null, result.path.drawerId, result.path.wallId)
  }
}

function handleKeydown(event: KeyboardEvent) {
  // Only handle when numbers are visible (focus is in results)
  if (!showNumbers.value) return

  // Handle 1-9 keys for quick highlight
  const key = event.key
  if (key >= '1' && key <= '9') {
    const index = parseInt(key) - 1
    if (index < props.results.length) {
      event.preventDefault()
      triggerHighlightByIndex(index)
    }
  }
}

function focus() {
  resultsListRef.value?.focus()
}

function handleFocusIn(event: FocusEvent) {
  // Only show numbers for keyboard focus, not mouse clicks
  const target = event.target as HTMLElement
  if (target.matches(':focus-visible')) {
    showNumbers.value = true
  }
}

function handleFocusOut(event: FocusEvent) {
  // Check if focus is moving outside the results list
  const relatedTarget = event.relatedTarget as HTMLElement | null
  if (!resultsListRef.value?.contains(relatedTarget)) {
    showNumbers.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

defineExpose({ focus })
</script>

<template>
  <div class="search-results">
    <div class="results-header">
      <h2>Search Results</h2>
      <span v-if="!isSearching" class="results-count">
        {{ results.length }} result{{ results.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <div v-if="isSearching" class="searching">
      <span class="spinner" />
      Searching...
    </div>

    <div
      v-else-if="results.length"
      ref="resultsListRef"
      class="results-list"
      tabindex="-1"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
    >
      <div
        v-for="(result, index) in results"
        :key="`${result.type}-${result.id}`"
        class="result-item"
        tabindex="0"
        @click="handleHighlight(null, result.path.drawerId, result.path.wallId)"
        @keydown.enter="handleHighlight(null, result.path.drawerId, result.path.wallId)"
      >
        <span v-if="showNumbers && index < 9" class="result-number">{{ index + 1 }}</span>
        <span class="result-icon" :class="`result-icon--${result.type}`">
          {{ getResultIcon(result.type) }}
        </span>
        <div class="result-content">
          <span class="result-name">{{ result.name }}</span>
          <span class="result-path">
            {{ result.path.wallName }} → {{ result.path.caseName }} → {{ result.path.drawerName || 'Unnamed drawer' }}
          </span>
          <span v-if="result.matchedField !== 'name'" class="result-match">
            Matched in {{ result.matchedField }}: {{ result.matchedText }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="no-results">
      No results found. Try a different search term.
    </div>
  </div>
</template>

<style scoped>
.search-results {
  flex: 1;
  padding: var(--spacing-lg) var(--wall-padding);
  background: white;
}

.results-header {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.results-header h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
}

.results-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.searching {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text-muted);
  padding: var(--spacing-lg);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-text-muted);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.result-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(0, 0, 0, 0.02);
  border-radius: var(--radius-md);
  text-align: left;
  transition: all var(--transition-fast);
  cursor: pointer;
  outline: none;
}

.result-item:hover,
.result-item:focus {
  background: rgba(0, 0, 0, 0.05);
}

.result-item:focus {
  box-shadow: 0 0 0 2px var(--color-primary);
}

.result-number {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  font-size: var(--font-size-xs);
  font-weight: 600;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}


.result-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.result-icon--part {
  background: var(--color-primary);
  color: white;
}

.result-icon--drawer {
  background: var(--wood-medium);
  color: white;
}

.result-icon--case {
  background: var(--wood-dark);
  color: white;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.result-name {
  font-weight: 600;
  word-break: break-word;
}

.result-path {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.result-match {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.no-results {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
}
</style>
