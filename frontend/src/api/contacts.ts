import client from './client'

export interface Agent {
  id: string
  first_name: string
  last_name: string
  agency_name: string
  email: string
}

export const getAgents = () =>
  client.get<any>('/agents/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )