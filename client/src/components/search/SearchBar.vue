<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useSearchStore, useCategoryStore } from '@/stores'

const model = defineModel<string>({ default: '' })
const searchStore = useSearchStore()
const categoryStore = useCategoryStore()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const selectedIndex = ref(-1)

const hasQuery = computed(() => model.value.trim().length > 0)

const suggestions = computed(() => {
  const query = model.value.trim().toLowerCase()
  if (!query || !isFocused.value) return []
  return categoryStore.categories.filter(cat =>
    cat.name.toLowerCase().includes(query)
  )
})

const showSuggestions = computed(() => suggestions.value.length > 0)

function clear() {
  model.value = ''
  searchStore.clearSearch()
  selectedIndex.value = -1
}

function focus() {
  inputRef.value?.focus()
}

function handleFocus() {
  isFocused.value = true
}

function handleBlur() {
  // Delay to allow click on suggestion to register
  setTimeout(() => {
    isFocused.value = false
    selectedIndex.value = -1
  }, 150)
}

function handleKeydown(event: KeyboardEvent) {
  // Handle Escape separately - it should always work
  if (event.key === 'Escape') {
    event.preventDefault()
    if (showSuggestions.value) {
      // First Escape closes suggestions
      isFocused.value = false
      selectedIndex.value = -1
    } else if (hasQuery.value) {
      // Second Escape clears the search
      clear()
      inputRef.value?.blur()
    } else {
      // No query, just blur
      inputRef.value?.blur()
    }
    return
  }

  // Handle Tab - close suggestions and jump to first result
  if (event.key === 'Tab' && !event.shiftKey) {
    isFocused.value = false
    selectedIndex.value = -1
    // Find and focus the first search result directly
    const firstResult = document.querySelector('.search-results .result-item') as HTMLElement
    if (firstResult) {
      event.preventDefault()
      firstResult.focus()
    }
    return
  }

  if (!showSuggestions.value) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
      break
    case 'Enter':
      if (selectedIndex.value >= 0) {
        event.preventDefault()
        selectSuggestion(suggestions.value[selectedIndex.value].name)
      }
      break
  }
}

function selectSuggestion(name: string) {
  model.value = name
  isFocused.value = false
  selectedIndex.value = -1
}

onMounted(() => {
  if (categoryStore.categories.length === 0) {
    categoryStore.fetchCategories()
  }
})

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
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
    <button
      v-if="hasQuery"
      class="search-clear"
      tabindex="-1"
      @click="clear"
      aria-label="Clear search"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
    <span v-if="searchStore.isSearching" class="search-spinner" />

    <div v-if="showSuggestions" class="suggestions-dropdown">
      <button
        v-for="(suggestion, index) in suggestions"
        :key="suggestion.id"
        class="suggestion-item"
        :class="{ 'is-selected': index === selectedIndex }"
        @mousedown="selectSuggestion(suggestion.name)"
      >
        <span class="suggestion-color" :style="{ backgroundColor: suggestion.color }" />
        <span class="suggestion-name">{{ suggestion.name }}</span>
      </button>
    </div>
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

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: var(--spacing-xs);
  background: white;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 100;
}

.suggestion-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.suggestion-item:hover,
.suggestion-item.is-selected {
  background: rgba(52, 152, 219, 0.1);
}

.suggestion-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.suggestion-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
