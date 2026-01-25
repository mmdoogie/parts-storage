import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as caseService from '@/services/caseService'
import type { Case, LayoutTemplate } from '@/types'

export const useCaseStore = defineStore('case', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const layoutTemplates = ref<LayoutTemplate[]>([])

  async function fetchLayoutTemplates() {
    try {
      layoutTemplates.value = await caseService.getLayoutTemplates()
      return layoutTemplates.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch layout templates'
      throw e
    }
  }

  async function updateCase(id: number, data: Partial<Case>): Promise<Case> {
    loading.value = true
    error.value = null
    try {
      const updatedCase = await caseService.updateCase(id, data)
      return updatedCase
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update case'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createCase(data: Partial<Case>): Promise<Case> {
    loading.value = true
    error.value = null
    try {
      const newCase = await caseService.createCase(data)
      return newCase
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create case'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteCase(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await caseService.deleteCase(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete case'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function applyTemplate(caseId: number, templateId: number): Promise<Case> {
    loading.value = true
    error.value = null
    try {
      const updatedCase = await caseService.applyTemplate(caseId, templateId)
      return updatedCase
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to apply template'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * Check if changing grid dimensions would affect existing drawers
   * Returns affected drawer info if any drawers would be outside the new grid
   */
  function checkGridChangeImpact(
    caseData: Case,
    newColumns: number,
    newRows: number
  ): { affected: boolean; message: string; drawerCount: number } {
    if (!caseData.drawers || caseData.drawers.length === 0) {
      return { affected: false, message: '', drawerCount: 0 }
    }

    let affectedCount = 0
    for (const drawer of caseData.drawers) {
      const drawerEndCol = drawer.gridColumn + (drawer.widthUnits ?? 1) - 1
      const drawerEndRow = drawer.gridRow + (drawer.heightUnits ?? 1) - 1

      if (drawerEndCol > newColumns || drawerEndRow > newRows) {
        affectedCount++
      }
    }

    if (affectedCount > 0) {
      return {
        affected: true,
        message: `${affectedCount} drawer(s) will be outside the new grid dimensions and may need to be repositioned or removed.`,
        drawerCount: affectedCount
      }
    }

    return { affected: false, message: '', drawerCount: 0 }
  }

  return {
    loading,
    error,
    layoutTemplates,
    fetchLayoutTemplates,
    updateCase,
    createCase,
    deleteCase,
    applyTemplate,
    checkGridChangeImpact
  }
})
