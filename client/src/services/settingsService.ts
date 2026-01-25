import api from './api'
import type { LayoutTemplate, DrawerPlacement, ApiResponse } from '@/types'

// Layout Templates API
export async function getLayoutTemplates(): Promise<LayoutTemplate[]> {
  const response = await api.get<unknown, ApiResponse<LayoutTemplate[]>>('/layout-templates')
  return response.data
}

export async function createLayoutTemplate(data: {
  name: string
  description?: string
  columns: number
  rows: number
  layoutData: DrawerPlacement[]
}): Promise<LayoutTemplate> {
  const response = await api.post<unknown, ApiResponse<LayoutTemplate>>('/layout-templates', data)
  return response.data
}

export async function updateLayoutTemplate(id: number, data: Partial<{
  name: string
  description: string
  columns: number
  rows: number
  layoutData: DrawerPlacement[]
}>): Promise<LayoutTemplate> {
  const response = await api.put<unknown, ApiResponse<LayoutTemplate>>(`/layout-templates/${id}`, data)
  return response.data
}

export async function deleteLayoutTemplate(id: number): Promise<void> {
  await api.delete(`/layout-templates/${id}`)
}
