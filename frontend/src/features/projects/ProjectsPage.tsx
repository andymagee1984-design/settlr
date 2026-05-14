// src/features/projects/ProjectsPage.tsx
// Route: /projects
// Replaces the previous lot-list view with a project tile grid.
// Clicking a tile navigates to /projects/:id (ProjectDetailPage).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, MapPin, ChevronRight, CalendarDays, Layers } from 'lucide-react'
import client from '../../api/client'
import type { ProjectListItem, ProjectStatus } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProjects(status?: ProjectStatus): Promise<ProjectListItem[]> {
  const params = status ? { status } : {}
  const { data } = await client.get<{ results: ProjectListItem[] }>('/projects/', { params })
  return data.results
}

export function useProjects(status?: ProjectStatus) {
  return useQuery({
    queryKey: ['projects', 'list', status],
    queryFn:  () => fetchProjects(status),
    staleTime: 30_000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: 'Active',    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  draft:     { label: 'Draft',     className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  completed: { label: 'Completed', className: 'bg-blue-50 text-blue-800 border border-blue-200' },
}

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_BADGE[status] ?? STATUS_BADGE.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot status bar
// ─────────────────────────────────────────────────────────────────────────────

const SEGMENT_COLOURS: Record<string, string> = {
  available: 'bg-emerald-500',
  on_hold:   'bg-amber-400',
  reserved:  'bg-blue-500',
  settled:   'bg-gray-400',
  draft:     'bg-gray-200',
}

function LotStatusBar({ counts }: { counts: ProjectListItem['lot_counts'] }) {
  const { total, available, on_hold, reserved, settled, draft } = counts
  if (total === 0) return <div className="h-1.5 w-full rounded-full bg-gray-100" />

  const segments = [
    { key: 'available', value: available },
    { key: 'on_hold',   value: on_hold },
    { key: 'reserved',  value: reserved },
    { key: 'settled',   value: settled },
    { key: 'draft',     value: draft },
  ].filter(s => s.value > 0)

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full gap-px">
      {segments.map(({ key, value }) => (
        <div
          key={key}
          className={`h-full ${SEGMENT_COLOURS[key]}`}
          style={{ width: `${(value / total) * 100}%` }}
          title={`${value} ${key.replace('_', ' ')}`}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GR formatter
// ─────────────────────────────────────────────────────────────────────────────

function formatGR(totalGr: string | null | undefined): string {
  if (!totalGr) return '—'
  const n = Number(totalGr)
  if (isNaN(n) || n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n.toLocaleString()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Project card
// ─────────────────────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: ProjectListItem; onClick: () => void }) {
  const c = project.lot_counts

  // Available = only lots with no active sale
  // Active sales = on_hold + reserved (live sales, pre-settlement)
  const activeSales = c.on_hold + c.reserved

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-150 hover:border-gray-300 hover:shadow-sm hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 flex flex-col"
    >
      {/* Hero image — fixed height, always cropped */}
      <div className="relative h-48 bg-gray-50 overflow-hidden shrink-0">
        {project.hero_image_url ? (
          <img
            src={project.hero_image_url}
            alt={project.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-10 w-10 text-gray-300" />
          </div>
        )}
        <div className="absolute top-2.5 right-2.5">
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <p className="text-sm font-medium text-gray-900 leading-snug">{project.name}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="h-3 w-3 shrink-0" />
          {project.address}
        </p>

        {/* Tagline — always reserves space so stats row aligns across cards */}
        <div className="mt-2.5 pb-2.5 border-b border-gray-100 min-h-[32px]">
          {project.tagline && (
            <p className="text-xs italic text-gray-500">{project.tagline}</p>
          )}
        </div>

        <div className="mt-3">
          <LotStatusBar counts={c} />
        </div>

        {/* Stats: Total lots | Available | Active sales | GR */}
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-base font-medium text-gray-900">{c.total}</p>
            <p className="text-[11px] text-gray-400">Total lots</p>
          </div>
          <div>
            <p className="text-base font-medium text-emerald-600">{c.available}</p>
            <p className="text-[11px] text-gray-400">Available</p>
          </div>
          <div>
            <p className="text-base font-medium text-amber-500">{activeSales}</p>
            <p className="text-[11px] text-gray-400">Active sales</p>
          </div>
          <div>
            <p className="text-base font-medium text-indigo-600">{formatGR(project.total_gr)}</p>
            <p className="text-[11px] text-gray-400">GR</p>
          </div>
        </div>
      </div>

      {/* Footer — pinned to bottom */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 mt-auto">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Layers className="h-3 w-3" />
          {project.stage_count} stage{project.stage_count !== 1 ? 's' : ''}
          {project.billing_start_date && (
            <>
              <span className="mx-1">·</span>
              <CalendarDays className="h-3 w-3" />
              Active {project.billing_start_date}
            </>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Filter = 'all' | ProjectStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'Active' },
  { value: 'draft',     label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]

const LEGEND = [
  { label: 'Available', colour: 'bg-emerald-500' },
  { label: 'On hold',   colour: 'bg-amber-400' },
  { label: 'Reserved+', colour: 'bg-blue-500' },
  { label: 'Settled',   colour: 'bg-gray-400' },
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const { data: projects, isLoading, isError } = useProjects(
    filter === 'all' ? undefined : filter
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-medium text-gray-900">Projects</h1>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-6 pt-4 pb-2">
        {LEGEND.map(({ label, colour }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${colour}`} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="p-6 pt-3">
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-2 py-20 text-sm text-gray-400">
            <Building2 className="h-8 w-8" />
            <p>Could not load projects. Please try again.</p>
          </div>
        )}

        {!isLoading && !isError && projects?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-sm text-gray-400">
            <Building2 className="h-8 w-8" />
            <p>No projects match this filter.</p>
          </div>
        )}

        {!isLoading && !isError && projects && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}