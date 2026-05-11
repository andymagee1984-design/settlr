import client from './client'

export interface Activity {
  id: string
  activity_type: string
  subject: string
  description: string
  activity_date: string
  contact_type: string | null
  contact_id: string | null
  sale: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  created_by: string | null
  created_by_name: string | null
  due_date: string | null
  completed_at: string | null
  is_complete: boolean
  created_at: string
}

export const getActivities = (params?: Record<string, string>) =>
  client.get<any>('/activities/', { params }).then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const createActivity = (data: Record<string, unknown>) =>
  client.post<Activity>('/activities/', data).then((r) => r.data)

export const completeActivity = (id: string) =>
  client.post<Activity>(`/activities/${id}/complete/`).then((r) => r.data)