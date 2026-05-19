// src/api/client.ts

import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const client = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor — attach access token from store
// ─────────────────────────────────────────────────────────────────────────────

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor — on 401 clear auth and redirect to login
// ─────────────────────────────────────────────────────────────────────────────

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// Logout — calls backend to clear cookie then clears local state
// ─────────────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  try {
    await axios.post('/api/v1/auth/logout/', {}, { withCredentials: true })
  } catch {
    // Ignore — proceed regardless
  } finally {
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
  }
}

export default client