import api from './api'
import type { SearchResult, ApiResponse } from '@/types'

export async function search(query: string, options?: {
  category?: number
  limit?: number
}): Promise<SearchResult[]> {
  const params: Record<string, string | number> = { q: query }
  if (options?.category) params.category = options.category
  if (options?.limit) params.limit = options.limit

  const response = await api.get<unknown, ApiResponse<SearchResult[]>>('/search', { params })
  return response.data
}
