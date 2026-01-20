import api from './api'
import type { Drawer, DrawerSize, Category, ApiResponse } from '@/types'

export async function getDrawerSizes(): Promise<DrawerSize[]> {
  const response = await api.get<unknown, ApiResponse<DrawerSize[]>>('/drawer-sizes')
  return response.data
}

export async function getDrawer(id: number): Promise<Drawer> {
  const response = await api.get<unknown, ApiResponse<Drawer>>(`/drawers/${id}`)
  return response.data
}

export async function createDrawer(data: {
  caseId: number
  drawerSizeId: number
  gridColumn: number
  gridRow: number
  name?: string
  color?: string
}): Promise<Drawer> {
  const response = await api.post<unknown, ApiResponse<Drawer>>('/drawers', data)
  return response.data
}

export async function updateDrawer(id: number, data: Partial<Drawer>): Promise<Drawer> {
  const response = await api.put<unknown, ApiResponse<Drawer>>(`/drawers/${id}`, data)
  return response.data
}

export async function moveDrawer(id: number, target: {
  targetCaseId: number
  gridColumn: number
  gridRow: number
}): Promise<Drawer> {
  const response = await api.put<unknown, ApiResponse<Drawer>>(`/drawers/${id}/move`, target)
  return response.data
}

export async function deleteDrawer(id: number): Promise<void> {
  await api.delete(`/drawers/${id}`)
}

export async function addCategoryToDrawer(drawerId: number, categoryId: number): Promise<Category[]> {
  const response = await api.post<unknown, ApiResponse<Category[]>>(`/drawers/${drawerId}/categories`, { categoryId })
  return response.data
}

export async function removeCategoryFromDrawer(drawerId: number, categoryId: number): Promise<void> {
  await api.delete(`/drawers/${drawerId}/categories/${categoryId}`)
}
