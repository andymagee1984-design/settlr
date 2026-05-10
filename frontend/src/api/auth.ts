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

export const getMe = async (): Promise<User> => {
  const { data } = await client.get<User>('/auth/me/')
  return data
}

export const logout = async (): Promise<void> => {
  sessionStorage.removeItem('access_token')
}