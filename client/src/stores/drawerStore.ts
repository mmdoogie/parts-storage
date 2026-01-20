import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import * as drawerService from '@/services/drawerService'
import type { Drawer, DrawerSize } from '@/types'

export const useDrawerStore = defineStore('drawer', () => {
  const drawers = ref<Map<number, Drawer>>(new Map())
  const drawerSizes = ref<DrawerSize[]>([])
  const openDrawerId = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDrawerSizes() {
    try {
      drawerSizes.value = await drawerService.getDrawerSizes()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch drawer sizes'
    }
  }

  async function fetchDrawer(id: number) {
    loading.value = true
    error.value = null
    try {
      const drawer = await drawerService.getDrawer(id)
      drawers.value.set(id, drawer)
      return drawer
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch drawer'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createDrawer(data: {
    caseId: number
    drawerSizeId: number
    gridColumn: number
    gridRow: number
    name?: string
    color?: string
  }) {
    loading.value = true
    error.value = null
    try {
      const drawer = await drawerService.createDrawer(data)
      drawers.value.set(drawer.id, drawer)
      return drawer
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create drawer'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateDrawer(id: number, data: Partial<Drawer>) {
    error.value = null
    try {
      const drawer = await drawerService.updateDrawer(id, data)
      drawers.value.set(id, drawer)
      return drawer
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update drawer'
      throw e
    }
  }

  async function moveDrawer(id: number, target: {
    targetCaseId: number
    gridColumn: number
    gridRow: number
  }) {
    error.value = null

    // Get original drawer for rollback
    const original = drawers.value.get(id)
    if (!original) throw new Error('Drawer not found')

    // Optimistic update
    const optimisticDrawer = {
      ...original,
      caseId: target.targetCaseId,
      gridColumn: target.gridColumn,
      gridRow: target.gridRow
    }
    drawers.value.set(id, optimisticDrawer)

    try {
      const drawer = await drawerService.moveDrawer(id, target)
      drawers.value.set(id, drawer)
      return drawer
    } catch (e) {
      // Rollback on failure
      drawers.value.set(id, original)
      error.value = e instanceof Error ? e.message : 'Failed to move drawer'
      throw e
    }
  }

  async function deleteDrawer(id: number) {
    error.value = null
    try {
      await drawerService.deleteDrawer(id)
      drawers.value.delete(id)
      if (openDrawerId.value === id) {
        openDrawerId.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete drawer'
      throw e
    }
  }

  function setOpenDrawer(id: number | null) {
    openDrawerId.value = id
  }

  function setDrawer(drawer: Drawer) {
    drawers.value.set(drawer.id, drawer)
  }

  const openDrawer = computed(() =>
    openDrawerId.value ? drawers.value.get(openDrawerId.value) : null
  )

  const getDrawerById = computed(() => (id: number) => drawers.value.get(id))

  const getSizeByName = computed(() => (name: string) =>
    drawerSizes.value.find(s => s.name === name)
  )

  return {
    drawers,
    drawerSizes,
    openDrawerId,
    openDrawer,
    loading,
    error,
    getDrawerById,
    getSizeByName,
    fetchDrawerSizes,
    fetchDrawer,
    createDrawer,
    updateDrawer,
    moveDrawer,
    deleteDrawer,
    setOpenDrawer,
    setDrawer
  }
})
