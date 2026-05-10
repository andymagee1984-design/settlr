import client from './client'

export interface Lot {
  id: string
  lot_number: string
  lot_type: string
  status: string
  is_released: boolean
  current_price: number | null
  stage_name: string
  project_name: string
  bedrooms: number | null
  bathrooms: number | null
  car_spaces: number | null
  land_area: number | null
  floor_area: number | null
  aspect: string
  level: number | null
  building: string
}

export interface Project {
  id: string
  name: string
  address: string
  status: string
  billing_status: string
  billing_lot_count: number | null
}

export const getProjects = () =>
  client.get<any>('/projects/').then((r) => {
    return Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  })

export const getLots = (params?: { status?: string; project?: string }) =>
  client.get<any>('/lots/', { params }).then((r) => {
    return Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  })