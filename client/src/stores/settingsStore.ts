import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import * as settingsService from '@/services/settingsService'
import type { DrawerSize, LayoutTemplate } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const drawerSizes = ref<DrawerSize[]>([])
  const layoutTemplates = ref<LayoutTemplate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const settingsModalOpen = ref(false)
  const editLocked = ref(true) // Default to locked to prevent accidental edits

  // Getters
  const getSizeById = computed(() => (id: number) =>
    drawerSizes.value.find(s => s.id === id)
  )

  const getSizeByName = computed(() => (name: string) =>
    drawerSizes.value.find(s => s.name === name)
  )

  const getTemplateById = computed(() => (id: number) =>
    layoutTemplates.value.find(t => t.id === id)
  )

  const builtinTemplates = computed(() =>
    layoutTemplates.value.filter(t => t.isBuiltin)
  )

  const customTemplates = computed(() =>
    layoutTemplates.value.filter(t => !t.isBuiltin)
  )

  // Drawer Size Actions
  async function fetchDrawerSizes() {
    try {
      drawerSizes.value = await settingsService.getDrawerSizes()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch drawer sizes'
      throw e
    }
  }

  async function createDrawerSize(data: {
    name: string
    widthUnits: number
    heightUnits: number
  }) {
    loading.value = true
    error.value = null
    try {
      const size = await settingsService.createDrawerSize(data)
      drawerSizes.value.push(size)
      // Sort by width then height
      drawerSizes.value.sort((a, b) =>
        a.widthUnits - b.widthUnits || a.heightUnits - b.heightUnits
      )
      return size
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create drawer size'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateDrawerSize(id: number, data: Partial<{
    name: string
    widthUnits: number
    heightUnits: number
  }>) {
    loading.value = true
    error.value = null
    try {
      const size = await settingsService.updateDrawerSize(id, data)
      const index = drawerSizes.value.findIndex(s => s.id === id)
      if (index !== -1) {
        drawerSizes.value[index] = size
      }
      // Re-sort
      drawerSizes.value.sort((a, b) =>
        a.widthUnits - b.widthUnits || a.heightUnits - b.heightUnits
      )
      return size
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update drawer size'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteDrawerSize(id: number) {
    loading.value = true
    error.value = null
    try {
      await settingsService.deleteDrawerSize(id)
      drawerSizes.value = drawerSizes.value.filter(s => s.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete drawer size'
      throw e
    } finally {
      loading.value = false
    }
  }

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
    layoutData: Array<{ col: number; row: number; size: string }>
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
    layoutData: Array<{ col: number; row: number; size: string }>
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
      await Promise.all([
        fetchDrawerSizes(),
        fetchLayoutTemplates()
      ])
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    drawerSizes,
    layoutTemplates,
    loading,
    error,
    settingsModalOpen,
    editLocked,
    // Getters
    getSizeById,
    getSizeByName,
    getTemplateById,
    builtinTemplates,
    customTemplates,
    // Drawer Size Actions
    fetchDrawerSizes,
    createDrawerSize,
    updateDrawerSize,
    deleteDrawerSize,
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
