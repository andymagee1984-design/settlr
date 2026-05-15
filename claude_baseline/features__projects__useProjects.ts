// src/features/projects/useProjects.ts

import { useQuery } from '@tanstack/react-query'
import client from '../../api/client'
import type { ProjectDetail, ProjectListItem, ProjectStatus } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────────────────

export const projectKeys = {
  all:    ()                       => ['projects']                  as const,
  list:   (status?: ProjectStatus) => ['projects', 'list', status]  as const,
  detail: (id: string)             => ['projects', 'detail', id]    as const,
  media:  (id: string)             => ['projects', 'media', id]     as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProjects(status?: ProjectStatus): Promise<ProjectListItem[]> {
  const params = status ? { status } : {}
  const { data } = await client.get<{ results: ProjectListItem[] }>('/projects/', { params })
  return data.results
}

async function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  const { data } = await client.get<ProjectDetail>(`/projects/${id}/`)
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useProjects(status?: ProjectStatus) {
  return useQuery({
    queryKey: projectKeys.list(status),
    queryFn:  () => fetchProjects(status),
    staleTime: 30_000,
  })
}

export function useProjectDetail(id: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(id!),
    queryFn:  () => fetchProjectDetail(id!),
    enabled:  !!id,
    staleTime: 60_000,
  })
}