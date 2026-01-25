import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import * as settingsService from '@/services/settingsService'
import type { LayoutTemplate, DrawerPlacement } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const layoutTemplates = ref<LayoutTemplate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const settingsModalOpen = ref(false)
  const editLocked = ref(true) // Default to locked to prevent accidental edits

  // Getters
  const getTemplateById = computed(() => (id: number) =>
    layoutTemplates.value.find(t => t.id === id)
  )

  const builtinTemplates = computed(() =>
    layoutTemplates.value.filter(t => t.isBuiltin)
  )

  const customTemplates = computed(() =>
    layoutTemplates.value.filter(t => !t.isBuiltin)
  )

  // Layout Template Actions
  async function fetchLayoutTemplates() {
    try {
      layoutTemplates.value = await settingsService.getLayoutTemplates()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch layout templates'
      throw e
    }
  }

  async function createLayoutTemplate(data: {
    name: string
    description?: string
    columns: number
    rows: number
    layoutData: DrawerPlacement[]
  }) {
    loading.value = true
    error.value = null
    try {
      const template = await settingsService.createLayoutTemplate(data)
      layoutTemplates.value.push(template)
      // Sort: built-in first, then by name
      layoutTemplates.value.sort((a, b) => {
        if (a.isBuiltin !== b.isBuiltin) return b.isBuiltin ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      return template
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create layout template'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateLayoutTemplate(id: number, data: Partial<{
    name: string
    description: string
    columns: number
    rows: number
    layoutData: DrawerPlacement[]
  }>) {
    loading.value = true
    error.value = null
    try {
      const template = await settingsService.updateLayoutTemplate(id, data)
      const index = layoutTemplates.value.findIndex(t => t.id === id)
      if (index !== -1) {
        layoutTemplates.value[index] = template
      }
      return template
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update layout template'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteLayoutTemplate(id: number) {
    loading.value = true
    error.value = null
    try {
      await settingsService.deleteLayoutTemplate(id)
      layoutTemplates.value = layoutTemplates.value.filter(t => t.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete layout template'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Modal control
  function openSettingsModal() {
    settingsModalOpen.value = true
  }

  function closeSettingsModal() {
    settingsModalOpen.value = false
  }

  // Edit lock control
  function toggleEditLock() {
    editLocked.value = !editLocked.value
  }

  function setEditLocked(locked: boolean) {
    editLocked.value = locked
  }

  // Initialize all settings data
  async function initializeSettings() {
    loading.value = true
    error.value = null
    try {
      await fetchLayoutTemplates()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    layoutTemplates,
    loading,
    error,
    settingsModalOpen,
    editLocked,
    // Getters
    getTemplateById,
    builtinTemplates,
    customTemplates,
    // Layout Template Actions
    fetchLayoutTemplates,
    createLayoutTemplate,
    updateLayoutTemplate,
    deleteLayoutTemplate,
    // Modal control
    openSettingsModal,
    closeSettingsModal,
    // Edit lock control
    toggleEditLock,
    setEditLocked,
    // Initialize
    initializeSettings
  }
})
