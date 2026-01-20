import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useDebounceFn } from '@vueuse/core'
import * as searchService from '@/services/searchService'
import type { SearchResult } from '@/types'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const results = ref<SearchResult[]>([])
  const isSearching = ref(false)
  const error = ref<string | null>(null)

  const debouncedSearch = useDebounceFn(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      results.value = []
      return
    }

    isSearching.value = true
    error.value = null

    try {
      results.value = await searchService.search(q)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed'
      results.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)

  watch(query, (q) => debouncedSearch(q))

  function clearSearch() {
    query.value = ''
    results.value = []
  }

  const highlightedDrawerIds = computed(() =>
    new Set(results.value.map(r => r.path.drawerId))
  )

  const hasResults = computed(() => results.value.length > 0)

  const isActive = computed(() => query.value.trim().length > 0)

  return {
    query,
    results,
    isSearching,
    error,
    highlightedDrawerIds,
    hasResults,
    isActive,
    clearSearch
  }
})
