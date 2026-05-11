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

export interface Buyer {
  id: string
  buyer_type: string
  display_name: string
  first_name: string
  last_name: string
  entity_name: string
  email: string
  phone: string
  address: string
  date_of_birth: string | null
  id_verified: boolean
  investment_intent: boolean
  created_at: string
}

export const getBuyers = () =>
  client.get<any>('/buyers/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const getAgents = () =>
  client.get<any>('/agents/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const getSolicitors = () =>
  client.get<any>('/solicitors/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const getReferrers = () =>
  client.get<any>('/referrers/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )
  export const getBuyer = (id: string) =>
  client.get<Buyer>(`/buyers/${id}/`).then((r) => r.data)

export const getAgent = (id: string) =>
  client.get<Agent>(`/agents/${id}/`).then((r) => r.data)

export const getSolicitor = (id: string) =>
  client.get<Solicitor>(`/solicitors/${id}/`).then((r) => r.data)

export const getReferrer = (id: string) =>
  client.get<Referrer>(`/referrers/${id}/`).then((r) => r.data)