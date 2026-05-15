// src/components/Layout.tsx

import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import { getNotifications, markAllRead, markOneRead } from '../api/notifications'
import type { Notification } from '../api/notifications'

const NOTIF_CONFIG: Record<string, { icon: string; iconColor: string; iconBg: string }> = {
  sale_pending:   { icon: 'ti-clock',           iconColor: '#BA7517', iconBg: '#FAEEDA' },
  sale_approved:  { icon: 'ti-check',           iconColor: '#3B6D11', iconBg: '#EAF3DE' },
  sale_declined:  { icon: 'ti-x',               iconColor: '#A32D2D', iconBg: '#FCEBEB' },
  on_hold_expiry: { icon: 'ti-alert-triangle',  iconColor: '#BA7517', iconBg: '#FAEEDA' },
  due_tomorrow:   { icon: 'ti-calendar',        iconColor: '#185FA5', iconBg: '#E6F1FB' },
  due_today:      { icon: 'ti-alarm',           iconColor: '#BA7517', iconBg: '#FAEEDA' },
  overdue:        { icon: 'ti-alert-circle',    iconColor: '#A32D2D', iconBg: '#FCEBEB' },
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

function NotificationDropdown({
  open,
  notifications,
  onMarkAllRead,
  onMarkOneRead,
  onNavigate,
}: {
  open: boolean
  notifications: Notification[]
  onMarkAllRead: () => void
  onMarkOneRead: (id: string) => void
  onNavigate: (target: string) => void
}) {
  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      width: 340,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
      zIndex: 1000,
      overflow: 'hidden',
      transformOrigin: 'top right',
      transform: open ? 'scaleY(1) translateY(0)' : 'scaleY(0.85) translateY(-8px)',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
      transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 180ms ease',
    }}>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Notifications</span>
          {unread > 0 && (
            <span style={{ background: '#E6F1FB', color: '#185FA5', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99 }}>
              {unread} new
            </span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={onMarkAllRead} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Mark all read
          </button>
        )}
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
            No notifications yet.
          </div>
        ) : (
          notifications.slice(0, 10).map((n, i) => {
            const cfg = NOTIF_CONFIG[n.notif_type] ?? NOTIF_CONFIG.sale_pending
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) onMarkOneRead(n.id)
                  if (n.sale_id) onNavigate('sales')
                }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 16px',
                  borderBottom: i < Math.min(notifications.length, 10) - 1 ? '1px solid #f1f5f9' : 'none',
                  background: n.is_read ? '#fff' : '#f8faff',
                  cursor: n.sale_id ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (n.sale_id) (e.currentTarget as HTMLDivElement).style.background = '#f1f5f9' }}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = n.is_read ? '#fff' : '#f8faff'}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 6, background: n.is_read ? 'transparent' : '#3b82f6' }} />
                <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: cfg.iconBg, color: cfg.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`ti ${cfg.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: n.is_read ? 400 : 600, color: '#111827', margin: 0, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', lineHeight: 1.4 }}>
                    {n.message.length > 80 ? n.message.slice(0, 80) + '…' : n.message}
                  </p>
                  <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
        <button onClick={() => onNavigate('notifications')} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          View all notifications
        </button>
      </div>
    </div>
  )
}

export default function Layout() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey:       ['notifications'],
    queryFn:        getNotifications,
    refetchInterval: 30_000,
    staleTime:       15_000,
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  const { mutate: doMarkAll } = useMutation({
    mutationFn: markAllRead,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const { mutate: doMarkOne } = useMutation({
    mutationFn: markOneRead,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleNavigate = (target: string) => {
    setOpen(false)
    navigate(`/${target}`)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar unreadCount={unreadCount} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          height: 48, flexShrink: 0,
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: open ? '#f1f5f9' : 'transparent',
                border: `1px solid ${open ? '#e2e8f0' : 'transparent'}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              aria-label="Notifications"
            >
              <i className="ti ti-bell" style={{ fontSize: 18, color: '#6b7280' }} aria-hidden="true" />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#E24B4A', border: '1.5px solid #fff',
                }} />
              )}
            </button>

            <NotificationDropdown
              open={open}
              notifications={notifications}
              onMarkAllRead={doMarkAll}
              onMarkOneRead={doMarkOne}
              onNavigate={handleNavigate}
            />
          </div>
        </div>

        <main style={{ flex: 1, overflowY: 'auto', background: '#f9fafb', minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}