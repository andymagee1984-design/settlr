// LOCATION: property_crm/frontend/src/features/notifications/NotificationsPage.tsx
// Full replacement.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markAllRead, markOneRead } from '../../api/notifications'
import type { Notification } from '../../api/notifications'

const NOTIF_CONFIG: Record<string, { icon: string; iconColor: string; iconBg: string; label: string }> = {
  // Sale notifications
  sale_pending:          { icon: 'ti-clock',          iconColor: '#9a5f00', iconBg: '#fef6ec', label: 'Pending approval'   },
  sale_approved:         { icon: 'ti-check',          iconColor: '#1a5c2e', iconBg: '#eef7f0', label: 'Sale approved'      },
  sale_declined:         { icon: 'ti-x',              iconColor: '#882010', iconBg: '#fdf0ee', label: 'Sale declined'      },
  on_hold_expiry:        { icon: 'ti-alert-triangle', iconColor: '#9a5f00', iconBg: '#fef6ec', label: 'On hold expiring'   },
  due_tomorrow:          { icon: 'ti-calendar',       iconColor: '#2649a0', iconBg: '#eef2fb', label: 'Due tomorrow'       },
  due_today:             { icon: 'ti-alarm',          iconColor: '#9a5f00', iconBg: '#fef6ec', label: 'Due today'          },
  overdue:               { icon: 'ti-alert-circle',   iconColor: '#882010', iconBg: '#fdf0ee', label: 'Overdue'            },
  // DA notifications
  da_lapse_warning:      { icon: 'ti-calendar-x',     iconColor: '#882010', iconBg: '#fdf0ee', label: 'DA lapsing'         },
  da_condition_due_soon: { icon: 'ti-calendar-clock', iconColor: '#9a5f00', iconBg: '#fef6ec', label: 'Condition due soon' },
  da_condition_overdue:  { icon: 'ti-alert-circle',   iconColor: '#882010', iconBg: '#fdf0ee', label: 'Condition overdue'  },
  da_milestone_overdue:  { icon: 'ti-flag-x',         iconColor: '#882010', iconBg: '#fdf0ee', label: 'Milestone overdue'  },
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
    staleTime: 20_000,
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
    <div style={{ padding: '24px 28px', maxWidth: 720, background: '#f9f6f4', minHeight: '100vh' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2c2420', margin: 0 }}>Notifications</h1>
          <div style={{ fontSize: 13, color: '#7a6e68', marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => doMarkAll()} style={{
            padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: '#a89e98', fontSize: 14 }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: '#fff', border: '1px solid #e8e2dd', borderRadius: 12 }}>
          <i className="ti ti-bell-off" style={{ fontSize: 32, color: '#d4ccc5', display: 'block', marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#a89e98', margin: 0 }}>No notifications yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => {
            const cfg         = NOTIF_CONFIG[n.notif_type] ?? NOTIF_CONFIG.sale_pending
            const isClickable = !!(n.sale_id || n.project_id)
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) doMarkOne(n.id)
                  if (n.sale_id) {
                    navigate('/sales')
                  } else if (n.project_id) {
                    navigate(`/projects/${n.project_id}?tab=planning`)
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px',
                  background: n.is_read ? '#fff' : '#faf8f7',
                  border: `1px solid ${n.is_read ? '#e8e2dd' : '#e8c4bb'}`,
                  borderRadius: 10,
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'background 0.1s, border-color 0.1s',
                  boxShadow: n.is_read ? 'none' : '0 1px 3px rgba(192,83,58,0.06)',
                }}
                onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = '#f2f0ee' }}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = n.is_read ? '#fff' : '#faf8f7'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 7, background: n.is_read ? 'transparent' : '#c0533a' }} />
                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: cfg.iconBg, color: cfg.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${cfg.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: '#2c2420', margin: 0 }}>
                      {n.title}
                    </p>
                    <span style={{ fontSize: 11, color: '#a89e98', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#7a6e68', margin: '3px 0 0', lineHeight: 1.5 }}>{n.message}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 99, background: cfg.iconBg, color: cfg.iconColor }}>
                      {cfg.label}
                    </span>
                    {n.lot_number && (
                      <span style={{ fontSize: 11, color: '#a89e98' }}>Lot {n.lot_number} · {n.project_name}</span>
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