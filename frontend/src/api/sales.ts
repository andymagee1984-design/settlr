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
  secondary_buyer: string | null
  agent: string | null
  status: string
  on_hold_expiry: string | null
  sale_price: number | null
  cooling_off_waived: boolean
  cooling_off_expiry: string | null
  subject_to_finance: boolean
  finance_due_date: string | null
  approved_at: string | null
  fallen_over_at: string | null
  fallen_over_reason: string | null
  settled_at: string | null
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

export const approveSale = (id: string) =>
  client.post<Sale>(`/sales/${id}/approve/`).then((r) => r.data)

export const declineSale = (id: string, reason: string) =>
  client.post<Sale>(`/sales/${id}/decline/`, { reason }).then((r) => r.data)

export const fallOverSale = (id: string, reason: string) =>
  client.post<Sale>(`/sales/${id}/fall_over/`, { reason }).then((r) => r.data)

export const submitSale = (id: string, data: FormData) =>
  client.post<Sale>(`/sales/${id}/submit/`, data).then((r) => r.data)

export const progressSale = (id: string, data: FormData) =>
  client.post<Sale>(`/sales/${id}/progress/`, data).then((r) => r.data)
export const getSale = (id: string) =>
  client.get<Sale>(`/sales/${id}/`).then((r) => r.data)
export const getSalesByBuyer = (buyerId: string) =>
  client.get<any>('/sales/', { params: { buyer: buyerId } }).then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )