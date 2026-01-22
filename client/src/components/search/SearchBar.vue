<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSearchStore } from '@/stores'

const model = defineModel<string>({ default: '' })
const searchStore = useSearchStore()

const inputRef = ref<HTMLInputElement | null>(null)

const hasQuery = computed(() => model.value.trim().length > 0)

function clear() {
  model.value = ''
  searchStore.clearSearch()
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="search-bar" :class="{ 'is-active': hasQuery }">
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
    <input
      ref="inputRef"
      v-model="model"
      type="text"
      placeholder="Search parts, categories..."
      class="search-input"
    />
    <button
      v-if="hasQuery"
      class="search-clear"
      @click="clear"
      aria-label="Clear search"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
    <span v-if="searchStore.isSearching" class="search-spinner" />
  </div>
</template>

<style scoped>
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-md);
  padding: var(--spacing-xs) var(--spacing-sm);
  transition: all var(--transition-fast);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.search-bar:focus-within,
.search-bar.is-active {
  background: white;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.05),
    0 0 0 2px var(--color-primary);
}

.search-icon {
  width: 20px;
  height: 20px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--color-text);
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-clear {
  padding: var(--spacing-xs);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.search-clear:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--color-text);
}

.search-clear svg {
  width: 16px;
  height: 16px;
}

.search-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-text-muted);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
