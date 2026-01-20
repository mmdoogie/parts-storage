import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import * as categoryService from '@/services/categoryService'
import type { Category } from '@/types'
import type { CategoryDrawer } from '@/services/categoryService'

export const useCategoryStore = defineStore('category', () => {
  const categories = ref<Category[]>([])
  const activeFilter = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCategories() {
    loading.value = true
    error.value = null
    try {
      categories.value = await categoryService.getCategories()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch categories'
    } finally {
      loading.value = false
    }
  }

  async function createCategory(data: Partial<Category>) {
    error.value = null
    try {
      const category = await categoryService.createCategory(data)
      categories.value.push(category)
      return category
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create category'
      throw e
    }
  }

  async function updateCategory(id: number, data: Partial<Category>) {
    error.value = null
    try {
      const category = await categoryService.updateCategory(id, data)
      const index = categories.value.findIndex(c => c.id === id)
      if (index !== -1) categories.value[index] = category
      return category
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update category'
      throw e
    }
  }

  async function deleteCategory(id: number) {
    error.value = null
    try {
      await categoryService.deleteCategory(id)
      categories.value = categories.value.filter(c => c.id !== id)
      if (activeFilter.value === id) {
        activeFilter.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete category'
      throw e
    }
  }

  function setFilter(categoryId: number | null) {
    activeFilter.value = categoryId
  }

  const getCategoryById = computed(() => (id: number) =>
    categories.value.find(c => c.id === id)
  )

  async function getCategoryDrawers(id: number): Promise<CategoryDrawer[]> {
    try {
      return await categoryService.getCategoryDrawers(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to get category drawers'
      throw e
    }
  }

  return {
    categories,
    activeFilter,
    loading,
    error,
    getCategoryById,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryDrawers,
    setFilter
  }
})
