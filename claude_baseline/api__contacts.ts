// src/api/contacts.ts

import client from './client'

export interface Agent {
  id: string
  first_name: string
  last_name: string
  agency_name: string
  email: string
  phone: string
  is_active: boolean
}

export interface Agency {
  id: string
  name: string
  address: string
  phone: string
  email: string
}

export interface Solicitor {
  id: string
  first_name: string
  last_name: string
  firm_name: string
  email: string
  phone: string
  address: string
}

export interface Referrer {
  id: string
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone: string
}

export type InterestLevel = string
export type ProspectSource = string

export interface Buyer {
  id: string
  buyer_type: 'individual' | 'company' | 'trust'
  display_name: string
  is_converted: boolean

  // Individual
  first_name: string
  last_name: string
  date_of_birth: string | null
  occupation: string

  // Company / trust
  entity_name: string
  abn: string
  trustee_name: string

  // Contact
  email: string
  phone: string
  address: string

  // Prospect fields
  interest_level: InterestLevel
  budget_min: number | null
  budget_max: number | null
  preferred_lot_type: string
  source: ProspectSource
  notes: string

  // Flags
  investment_intent: boolean
  marketing_opt_in: boolean
  id_verified: boolean

  // Conversion
  converted_at: string | null
  created_at: string
}

export const getBuyers = () =>
  client.get<any>('/buyers/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const getBuyer = (id: string) =>
  client.get<Buyer>(`/buyers/${id}/`).then((r) => r.data)

export const updateBuyer = (id: string, data: Record<string, any>) =>
  client.patch<Buyer>(`/buyers/${id}/`, data).then((r) => r.data)

export const getAgents = () =>
  client.get<any>('/agents/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const getAgent = (id: string) =>
  client.get<Agent>(`/agents/${id}/`).then((r) => r.data)

export const getSolicitors = () =>
  client.get<any>('/solicitors/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const getSolicitor = (id: string) =>
  client.get<Solicitor>(`/solicitors/${id}/`).then((r) => r.data)

export const getReferrers = () =>
  client.get<any>('/referrers/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const getReferrer = (id: string) =>
  client.get<Referrer>(`/referrers/${id}/`).then((r) => r.data)

export const createAgency = (data: Record<string, unknown>) =>
  client.post<Agency>('/agencies/', data).then((r) => r.data)