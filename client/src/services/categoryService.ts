import api from './api'
import type { Category, ApiResponse } from '@/types'

export async function getCategories(): Promise<Category[]> {
  const response = await api.get<unknown, ApiResponse<Category[]>>('/categories')
  return response.data
}

export async function getCategory(id: number): Promise<Category> {
  const response = await api.get<unknown, ApiResponse<Category>>(`/categories/${id}`)
  return response.data
}

export async function createCategory(data: Partial<Category>): Promise<Category> {
  const response = await api.post<unknown, ApiResponse<Category>>('/categories', data)
  return response.data
}

export async function updateCategory(id: number, data: Partial<Category>): Promise<Category> {
  const response = await api.put<unknown, ApiResponse<Category>>(`/categories/${id}`, data)
  return response.data
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/categories/${id}`)
}

export interface CategoryDrawer {
  id: number
  name: string | null
  path: {
    wallId: number
    wallName: string
    caseId: number
    caseName: string
  }
}

export async function getCategoryDrawers(id: number): Promise<CategoryDrawer[]> {
  const response = await api.get<unknown, ApiResponse<CategoryDrawer[]>>(`/categories/${id}/drawers`)
  return response.data
}
