import client from './client'

export interface Buyer {
  id: string
  buyer_type: 'individual' | 'company' | 'trust'
  display_name: string
  first_name: string
  last_name: string
  entity_name: string
  email: string
  phone: string
  address: string
  date_of_birth: string | null
  id_verified: boolean
}

export interface Sale {
  id: string
  lot: string
  lot_number: string
  project_name: string
  primary_buyer: string
  primary_buyer_name: string
  status: string
  on_hold_expiry: string | null
  sale_price: number | null
  created_at: string
}

export const searchBuyers = (q: string) =>
  client.get<any>('/buyers/', { params: { search: q } }).then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const createBuyer = (data: Record<string, unknown>) =>
  client.post<Buyer>('/buyers/', data).then((r) => r.data)

export const createSale = (data: Record<string, unknown>) =>
  client.post<Sale>('/sales/', data).then((r) => r.data)

export const getSales = () =>
  client.get<any>('/sales/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )