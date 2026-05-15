export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: Role | null
  is_active: boolean
}

export interface Role {
  id: string
  name: string
  is_system_role: boolean
  permissions: Permission[]
}

export interface Permission {
  id: number
  code: string
  description: string
  category: string
}

export interface ApiError {
  error: string
  detail: string
  fields?: Record<string, string[]>
}