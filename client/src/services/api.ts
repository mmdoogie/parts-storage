import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Response interceptor to unwrap data
api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error?.message || error.message || 'An error occurred'
    return Promise.reject(new Error(message))
  }
)

export default api
