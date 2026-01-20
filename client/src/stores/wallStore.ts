import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import * as wallService from '@/services/wallService'
import type { Wall, Case } from '@/types'

export const useWallStore = defineStore('wall', () => {
  const walls = ref<Wall[]>([])
  const currentWall = ref<Wall | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchWalls() {
    loading.value = true
    error.value = null
    try {
      walls.value = await wallService.getWalls()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch walls'
    } finally {
      loading.value = false
    }
  }

  async function fetchWall(id: number) {
    loading.value = true
    error.value = null
    try {
      currentWall.value = await wallService.getWall(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch wall'
    } finally {
      loading.value = false
    }
  }

  async function createWall(data: Partial<Wall>) {
    loading.value = true
    error.value = null
    try {
      const wall = await wallService.createWall(data)
      walls.value.push(wall)
      return wall
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create wall'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateWall(id: number, data: Partial<Wall>) {
    error.value = null
    try {
      const wall = await wallService.updateWall(id, data)
      const index = walls.value.findIndex(w => w.id === id)
      if (index !== -1) walls.value[index] = wall
      if (currentWall.value?.id === id) {
        currentWall.value = { ...currentWall.value, ...wall }
      }
      return wall
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update wall'
      throw e
    }
  }

  async function deleteWall(id: number) {
    error.value = null
    try {
      await wallService.deleteWall(id)
      walls.value = walls.value.filter(w => w.id !== id)
      if (currentWall.value?.id === id) {
        currentWall.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete wall'
      throw e
    }
  }

  // Update a case within the current wall (for optimistic updates)
  function updateCaseInWall(caseData: Case) {
    if (!currentWall.value?.cases) return
    const index = currentWall.value.cases.findIndex(c => c.id === caseData.id)
    if (index !== -1) {
      currentWall.value.cases[index] = caseData
    }
  }

  // Add a case to the current wall
  function addCaseToWall(caseData: Case) {
    if (!currentWall.value) return
    if (!currentWall.value.cases) {
      currentWall.value.cases = []
    }
    currentWall.value.cases.push(caseData)
  }

  // Remove a case from the current wall
  function removeCaseFromWall(caseId: number) {
    if (!currentWall.value?.cases) return
    currentWall.value.cases = currentWall.value.cases.filter(c => c.id !== caseId)
  }

  const hasWalls = computed(() => walls.value.length > 0)

  return {
    walls,
    currentWall,
    loading,
    error,
    hasWalls,
    fetchWalls,
    fetchWall,
    createWall,
    updateWall,
    deleteWall,
    updateCaseInWall,
    addCaseToWall,
    removeCaseFromWall
  }
})
