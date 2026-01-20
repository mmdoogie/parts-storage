<script setup lang="ts">
import type { SearchResult } from '@/types'

interface Props {
  results: SearchResult[]
  isSearching: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  select: [drawerId: number]
}>()

function getResultIcon(type: string) {
  switch (type) {
    case 'part': return 'P'
    case 'drawer': return 'D'
    case 'case': return 'C'
    default: return '?'
  }
}
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

    <div v-else-if="results.length" class="results-list">
      <button
        v-for="result in results"
        :key="`${result.type}-${result.id}`"
        class="result-item"
        @click="emit('select', result.path.drawerId)"
      >
        <span class="result-icon" :class="`result-icon--${result.type}`">
          {{ getResultIcon(result.type) }}
        </span>
        <div class="result-content">
          <span class="result-name">{{ result.name }}</span>
          <span class="result-path">
            {{ result.path.caseName }} → {{ result.path.drawerName || 'Unnamed drawer' }}
          </span>
          <span v-if="result.matchedField !== 'name'" class="result-match">
            Matched in {{ result.matchedField }}: {{ result.matchedText }}
          </span>
        </div>
      </button>
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
}

.result-item:hover {
  background: rgba(0, 0, 0, 0.05);
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
