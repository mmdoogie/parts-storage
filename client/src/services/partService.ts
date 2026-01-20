import api from './api'
import type { Part, PartLink, ApiResponse } from '@/types'

export async function getParts(drawerId: number): Promise<Part[]> {
  const response = await api.get<unknown, ApiResponse<Part[]>>('/parts', {
    params: { drawerId }
  })
  return response.data
}

export async function getPart(id: number): Promise<Part> {
  const response = await api.get<unknown, ApiResponse<Part>>(`/parts/${id}`)
  return response.data
}

export async function createPart(data: {
  drawerId: number
  name: string
  notes?: string
  sortOrder?: number
}): Promise<Part> {
  const response = await api.post<unknown, ApiResponse<Part>>('/parts', data)
  return response.data
}

export async function updatePart(id: number, data: Partial<Part>): Promise<Part> {
  const response = await api.put<unknown, ApiResponse<Part>>(`/parts/${id}`, data)
  return response.data
}

export async function movePart(id: number, targetDrawerId: number): Promise<Part> {
  const response = await api.put<unknown, ApiResponse<Part>>(`/parts/${id}/move`, { targetDrawerId })
  return response.data
}

export async function deletePart(id: number): Promise<void> {
  await api.delete(`/parts/${id}`)
}

export async function addLinkToPart(partId: number, data: {
  url: string
  title?: string
  sortOrder?: number
}): Promise<PartLink> {
  const response = await api.post<unknown, ApiResponse<PartLink>>(`/parts/${partId}/links`, data)
  return response.data
}

export async function updateLink(id: number, data: Partial<PartLink>): Promise<PartLink> {
  const response = await api.put<unknown, ApiResponse<PartLink>>(`/links/${id}`, data)
  return response.data
}

export async function deleteLink(id: number): Promise<void> {
  await api.delete(`/links/${id}`)
}
