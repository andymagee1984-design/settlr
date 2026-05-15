// src/features/notifications/NotificationsPage.tsx

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markAllRead, markOneRead } from '../../api/notifications'
import type { Notification } from '../../api/notifications'

const NOTIF_CONFIG: Record<string, { icon: string; iconColor: string; iconBg: string; label: string }> = {
  sale_pending:   { icon: 'ti-clock',          iconColor: '#BA7517', iconBg: '#FAEEDA', label: 'Pending approval'  },
  sale_approved:  { icon: 'ti-check',          iconColor: '#3B6D11', iconBg: '#EAF3DE', label: 'Sale approved'     },
  sale_declined:  { icon: 'ti-x',              iconColor: '#A32D2D', iconBg: '#FCEBEB', label: 'Sale declined'     },
  on_hold_expiry: { icon: 'ti-alert-triangle', iconColor: '#BA7517', iconBg: '#FAEEDA', label: 'On hold expiring'  },
  due_tomorrow:   { icon: 'ti-calendar',       iconColor: '#185FA5', iconBg: '#E6F1FB', label: 'Due tomorrow'      },
  due_today:      { icon: 'ti-alarm',          iconColor: '#BA7517', iconBg: '#FAEEDA', label: 'Due today'         },
  overdue:        { icon: 'ti-alert-circle',   iconColor: '#A32D2D', iconBg: '#FCEBEB', label: 'Overdue'           },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

export default function NotificationsPage() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey:  ['notifications'],
    queryFn:   getNotifications,
    staleTime: 15_000,
  })

  const { mutate: doMarkAll } = useMutation({
    mutationFn: markAllRead,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const { mutate: doMarkOne } = useMutation({
    mutationFn: markOneRead,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 720 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Notifications</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => doMarkAll()} style={{
            padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
          }}>
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <i className="ti ti-bell-off" style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>No notifications yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => {
            const cfg = NOTIF_CONFIG[n.notif_type] ?? NOTIF_CONFIG.sale_pending
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) doMarkOne(n.id)
                  if (n.sale_id) navigate('/sales')
                }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px',
                  background: n.is_read ? '#fff' : '#f8faff',
                  border: `1px solid ${n.is_read ? '#e2e8f0' : '#bfdbfe'}`,
                  borderRadius: 10,
                  cursor: n.sale_id ? 'pointer' : 'default',
                  transition: 'background 0.1s, border-color 0.1s',
                  boxShadow: n.is_read ? 'none' : '0 1px 3px rgba(37,99,235,0.06)',
                }}
                onMouseEnter={e => { if (n.sale_id) (e.currentTarget as HTMLDivElement).style.background = '#f1f5f9' }}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = n.is_read ? '#fff' : '#f8faff'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 7, background: n.is_read ? 'transparent' : '#3b82f6' }} />
                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: cfg.iconBg, color: cfg.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${cfg.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: '#111827', margin: 0 }}>
                      {n.title}
                    </p>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0', lineHeight: 1.5 }}>{n.message}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 99, background: cfg.iconBg, color: cfg.iconColor }}>
                      {cfg.label}
                    </span>
                    {n.lot_number && (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>Lot {n.lot_number} · {n.project_name}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}