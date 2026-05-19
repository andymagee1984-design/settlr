// src/api/auth.ts

import axios from 'axios'
import client from './client'
import type { User } from '../types/types'

export interface LoginCredentials {
  email: string
  password: string
}

export interface TokenResponse {
  access: string
  refresh: string
}

export const login = async (credentials: LoginCredentials): Promise<TokenResponse> => {
  const { data } = await client.post<TokenResponse>('/auth/token/', credentials)
  return data
}

export const getMe = async (token?: string): Promise<User> => {
  // If a token is provided (e.g. immediately after login before Zustand is populated),
  // use it directly rather than relying on the store interceptor.
  if (token) {
    const { data } = await axios.get<User>('/api/v1/auth/me/', {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    })
    return data
  }
  const { data } = await client.get<User>('/auth/me/')
  return data
}