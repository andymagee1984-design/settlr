// src/features/projects/ProjectsPage.tsx
//
// Route: /projects
// Shows project tiles with lot status bars and counts.
// Clicking a tile navigates to /projects/:id

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  MapPin,
  ChevronRight,
  CalendarDays,
  Layers,
} from 'lucide-react'

import { useProjects } from './useProjects'
import { LotStatusBar, LotStatusLegend, ProjectStatusBadge } from './components'
import type { ProjectListItem, ProjectStatus } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Filter options
// ─────────────────────────────────────────────────────────────────────────────

type Filter = 'all' | ProjectStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'Active' },
  { value: 'draft',     label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Project tile card
// ─────────────────────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: ProjectListItem; onClick: () => void }) {
  const { lot_counts: c } = project
  const onMarket = c.available + c.on_hold + c.reserved

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 12,
        border: '1px solid var(--crm-border)',
        background: 'var(--crm-surface)',
        overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--font-body)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--crm-border-strong)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--crm-border)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Hero image or placeholder */}
      <div style={{ position: 'relative', height: 128, background: 'var(--crm-bg)', overflow: 'hidden' }}>
        {project.hero_image_url ? (
          <img
            src={project.hero_image_url}
            alt={project.name}
            style={{ height: '100%', width: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 style={{ height: 40, width: 40, color: 'var(--crm-border-strong)' }} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--crm-text)', lineHeight: 1.3 }}>
          {project.name}
        </p>
        <p style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--crm-text-muted)' }}>
          <MapPin style={{ height: 12, width: 12, flexShrink: 0 }} />
          {project.address}
        </p>

        {project.tagline && (
          <p style={{
            marginTop: 10, fontSize: 12, fontStyle: 'italic',
            color: 'var(--crm-text-muted)', paddingBottom: 10,
            borderBottom: '1px solid var(--crm-border)',
          }}>
            {project.tagline}
          </p>
        )}

        {/* Lot status bar */}
        <div style={{ marginTop: 12 }}>
          <LotStatusBar counts={c} />
        </div>

        {/* Stats row */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--crm-text)' }}>{c.total}</p>
            <p style={{ fontSize: 11, color: 'var(--crm-text-faint)' }}>Total lots</p>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--lot-available-price)' }}>{onMarket}</p>
            <p style={{ fontSize: 11, color: 'var(--crm-text-faint)' }}>On market</p>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--crm-text-faint)' }}>{c.settled}</p>
            <p style={{ fontSize: 11, color: 'var(--crm-text-faint)' }}>Settled</p>
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid var(--crm-border)',
        padding: '10px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--crm-text-faint)' }}>
          <Layers style={{ height: 12, width: 12 }} />
          {project.stage_count} stage{project.stage_count !== 1 ? 's' : ''}
          {project.billing_start_date && (
            <>
              <span style={{ margin: '0 4px' }}>·</span>
              <CalendarDays style={{ height: 12, width: 12 }} />
              Active {project.billing_start_date}
            </>
          )}
        </div>
        <ChevronRight style={{ height: 16, width: 16, color: 'var(--crm-border-strong)' }} />
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const { data: projects, isLoading, isError } = useProjects(
    filter === 'all' ? undefined : filter
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--crm-bg)' }}>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--crm-border)',
        background: 'var(--crm-surface)',
        padding: '14px 24px',
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--crm-text)' }}>Projects</h1>

        {/* Filter pill group */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          borderRadius: 8, border: '1px solid var(--crm-border)',
          background: 'var(--crm-bg)', padding: 4,
        }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                borderRadius: 6, padding: '4px 12px',
                fontSize: 12, fontWeight: 500,
                border: filter === f.value ? '1px solid var(--crm-border)' : '1px solid transparent',
                background: filter === f.value ? 'var(--crm-surface)' : 'transparent',
                color: filter === f.value ? 'var(--crm-text)' : 'var(--crm-text-muted)',
                boxShadow: filter === f.value ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '16px 24px 8px' }}>
        <LotStatusLegend />
      </div>

      {/* Grid */}
      <div style={{ padding: '12px 24px 24px' }}>

        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 256, borderRadius: 12, background: 'var(--crm-border)', opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {isError && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '80px 0', fontSize: 13, color: 'var(--crm-text-faint)' }}>
            <Building2 style={{ height: 32, width: 32 }} />
            <p>Could not load projects. Please try again.</p>
          </div>
        )}

        {!isLoading && !isError && projects?.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '80px 0', fontSize: 13, color: 'var(--crm-text-faint)' }}>
            <Building2 style={{ height: 32, width: 32 }} />
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