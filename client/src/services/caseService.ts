import api from './api'
import type { Case, LayoutTemplate, ApiResponse } from '@/types'

export async function getCases(wallId?: number): Promise<Case[]> {
  const params = wallId ? { wallId } : {}
  const response = await api.get<unknown, ApiResponse<Case[]>>('/cases', { params })
  return response.data
}

export async function getCase(id: number): Promise<Case> {
  const response = await api.get<unknown, ApiResponse<Case>>(`/cases/${id}`)
  return response.data
}

export async function createCase(data: Partial<Case>): Promise<Case> {
  const response = await api.post<unknown, ApiResponse<Case>>('/cases', data)
  return response.data
}

export async function updateCase(id: number, data: Partial<Case>): Promise<Case> {
  const response = await api.put<unknown, ApiResponse<Case>>(`/cases/${id}`, data)
  return response.data
}

export async function updateCasePosition(id: number, position: {
  gridColumnStart?: number
  gridColumnSpan?: number
  gridRowStart?: number
  gridRowSpan?: number
}): Promise<Case> {
  const response = await api.put<unknown, ApiResponse<Case>>(`/cases/${id}/position`, position)
  return response.data
}

export async function applyTemplate(caseId: number, templateId: number): Promise<Case> {
  const response = await api.post<unknown, ApiResponse<Case>>(`/cases/${caseId}/apply-template`, { templateId })
  return response.data
}

export async function deleteCase(id: number): Promise<void> {
  await api.delete(`/cases/${id}`)
}

export async function getLayoutTemplates(): Promise<LayoutTemplate[]> {
  const response = await api.get<unknown, ApiResponse<LayoutTemplate[]>>('/layout-templates')
  return response.data
}
