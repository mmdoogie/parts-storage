import api from './api'
import type { Wall, ApiResponse } from '@/types'

export async function getWalls(): Promise<Wall[]> {
  const response = await api.get<unknown, ApiResponse<Wall[]>>('/walls')
  return response.data
}

export async function getWall(id: number): Promise<Wall> {
  const response = await api.get<unknown, ApiResponse<Wall>>(`/walls/${id}`)
  return response.data
}

export async function createWall(data: Partial<Wall>): Promise<Wall> {
  const response = await api.post<unknown, ApiResponse<Wall>>('/walls', data)
  return response.data
}

export async function updateWall(id: number, data: Partial<Wall>): Promise<Wall> {
  const response = await api.put<unknown, ApiResponse<Wall>>(`/walls/${id}`, data)
  return response.data
}

export async function deleteWall(id: number): Promise<void> {
  await api.delete(`/walls/${id}`)
}
