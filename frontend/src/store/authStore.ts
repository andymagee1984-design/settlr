// src/store/authStore.ts
//
// Access token stored in localStorage so it survives page refresh.
// The token lifetime is 8 hours (set in Django SIMPLE_JWT settings)
// so this is safe for the POC. Production should move to httpOnly cookies.
//
// On page load, the token is read from localStorage and the user is
// fetched from /auth/me/ to repopulate the store.

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
  user:            null,
  accessToken:     localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  setAuth: (user, token) => {
    localStorage.setItem('access_token', token)
    set({ user, accessToken: token, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem('access_token')
    set({ user: null, accessToken: null, isAuthenticated: false })
  },
}))