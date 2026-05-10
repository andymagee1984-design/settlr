import { create } from 'zustand'
import type { User } from '../types/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    sessionStorage.setItem('access_token', token)
    set({ user, accessToken: token, isAuthenticated: true })
  },

  clearAuth: () => {
    sessionStorage.removeItem('access_token')
    set({ user: null, accessToken: null, isAuthenticated: false })
  },
}))