import api from './api'
import type { DrawerSize, LayoutTemplate, ApiResponse } from '@/types'

// Drawer Sizes API
export async function getDrawerSizes(): Promise<DrawerSize[]> {
  const response = await api.get<unknown, ApiResponse<DrawerSize[]>>('/drawer-sizes')
  return response.data
}

export async function createDrawerSize(data: {
  name: string
  widthUnits: number
  heightUnits: number
}): Promise<DrawerSize> {
  const response = await api.post<unknown, ApiResponse<DrawerSize>>('/drawer-sizes', data)
  return response.data
}

export async function updateDrawerSize(id: number, data: Partial<{
  name: string
  widthUnits: number
  heightUnits: number
}>): Promise<DrawerSize> {
  const response = await api.put<unknown, ApiResponse<DrawerSize>>(`/drawer-sizes/${id}`, data)
  return response.data
}

export async function deleteDrawerSize(id: number): Promise<void> {
  await api.delete(`/drawer-sizes/${id}`)
}

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
  layoutData: Array<{ col: number; row: number; size: string }>
}): Promise<LayoutTemplate> {
  const response = await api.post<unknown, ApiResponse<LayoutTemplate>>('/layout-templates', data)
  return response.data
}

export async function updateLayoutTemplate(id: number, data: Partial<{
  name: string
  description: string
  columns: number
  rows: number
  layoutData: Array<{ col: number; row: number; size: string }>
}>): Promise<LayoutTemplate> {
  const response = await api.put<unknown, ApiResponse<LayoutTemplate>>(`/layout-templates/${id}`, data)
  return response.data
}

export async function deleteLayoutTemplate(id: number): Promise<void> {
  await api.delete(`/layout-templates/${id}`)
}
