// src/features/projects/types.ts

export type ProjectStatus  = 'draft' | 'active' | 'completed'
export type LotStatus      = 'draft' | 'available' | 'on_hold' | 'reserved' | 'settled'
export type LotType        = 'land' | 'house_and_land' | 'apartment' | 'townhouse' | 'commercial'
export type MediaType      = 'image' | 'document'
export type MediaCategory  = 'hero' | 'gallery' | 'brochure' | 'site_map' | 'floor_plan' | 'other'

export interface LotCounts {
  total: number
  draft: number
  available: number
  on_hold: number
  reserved: number
  settled: number
  total_gr: string | null
}

export interface ProjectMedia {
  id: string
  media_type: MediaType
  category: MediaCategory
  title: string
  file_url: string | null
  sort_order: number
  uploaded_by_name: string | null
  created_at: string
}

export interface ProjectMediaGrouped {
  hero: ProjectMedia[]
  gallery: ProjectMedia[]
  brochure: ProjectMedia[]
  site_map: ProjectMedia[]
  floor_plan: ProjectMedia[]
  other: ProjectMedia[]
}

export interface LotSummary {
  id: string
  lot_number: string
  lot_type: LotType
  bedrooms: number | null
  bathrooms: number | null
  car_spaces: number | null
  land_area: number | null
  floor_area: number | null
  aspect: string | null
  level: number | null
  building: string | null
  status: LotStatus
  current_price: number | null
}

export interface Stage {
  id: string
  name: string
  stage_number: number
  expected_release: string | null
  lot_count: number
  lots: LotSummary[]
}

export interface SolicitorMinimal {
  id: string
  full_name: string
  firm_name: string
  email: string
  phone: string
}

// Returned by GET /api/v1/projects/
export interface ProjectListItem {
  id: string
  name: string
  address: string
  status: ProjectStatus
  tagline: string | null
  website_url: string | null
  billing_lot_count: number | null
  billing_start_date: string | null
  billing_end_date: string | null
  billing_status: string
  stage_count: number
  lot_counts: LotCounts
  total_gr: string | null       // top-level GR from ProjectListSerializer
  hero_image_url: string | null
  created_at: string
}

// Returned by GET /api/v1/projects/{id}/
export interface ProjectDetail {
  id: string
  name: string
  address: string
  status: ProjectStatus
  tagline: string | null
  description: string | null
  website_url: string | null
  billing_lot_count: number | null
  billing_start_date: string | null
  billing_end_date: string | null
  billing_status: string
  solicitor: SolicitorMinimal | null
  lot_counts: LotCounts         // total_gr lives here for detail view
  stages: Stage[]
  media: ProjectMediaGrouped
  created_at: string
}