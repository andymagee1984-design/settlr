// src/components/Sidebar.tsx

import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Props {
  unreadCount: number
}

const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/',           icon: 'ti-layout-dashboard', label: 'Dashboard' },
    ],
  },
  {
    section: 'Main',
    items: [
      { to: '/projects',   icon: 'ti-building-estate',  label: 'Projects' },
      { to: '/sales',      icon: 'ti-file-dollar',       label: 'Sales' },
    ],
  },
  {
    section: 'People',
    items: [
      { to: '/contacts',   icon: 'ti-users',             label: 'Contacts' },
      { to: '/agencies',   icon: 'ti-building',          label: 'Agencies' },
    ],
  },
  {
    section: 'Insights',
    items: [
      { to: '/reports',       icon: 'ti-chart-bar',      label: 'Reports' },
      { to: '/activities',    icon: 'ti-checkbox',       label: 'Activities' },
      { to: '/notifications', icon: 'ti-bell',           label: 'Notifications' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Settlr mini logo mark — skyline icon only for sidebar header
// ─────────────────────────────────────────────────────────────────────────────

function SettlrMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 246 190" role="img" aria-label="Settlr">
      <title>Settlr</title>
      {/* Ground */}
      <rect x="0" y="157" width="246" height="3" rx="1.5" fill="#3b82f6" opacity="0.3"/>
      {/* Single dwelling */}
      <rect x="0" y="117" width="44" height="40" rx="2" fill="#93c5fd" opacity="0.7"/>
      <polygon points="22,90 48,117 -4,117" fill="#60a5fa" opacity="0.85"/>
      <rect x="15" y="133" width="14" height="24" rx="2" fill="#1d4ed8" opacity="0.6"/>
      <rect x="4" y="124" width="10" height="9" rx="1" fill="#dbeafe" opacity="0.9"/>
      {/* Townhouses */}
      <rect x="52" y="98" width="28" height="59" rx="2" fill="#60a5fa" opacity="0.75"/>
      <rect x="82" y="106" width="28" height="51" rx="2" fill="#60a5fa" opacity="0.6"/>
      <rect x="60" y="128" width="12" height="29" rx="2" fill="#1d4ed8" opacity="0.5"/>
      <rect x="90" y="128" width="12" height="29" rx="2" fill="#1d4ed8" opacity="0.4"/>
      <rect x="56" y="106" width="9" height="7" rx="1" fill="#dbeafe" opacity="0.8"/>
      <rect x="86" y="112" width="9" height="7" rx="1" fill="#dbeafe" opacity="0.8"/>
      {/* Mid-rise */}
      <rect x="118" y="64" width="42" height="93" rx="3" fill="#3b82f6" opacity="0.85"/>
      <rect x="124" y="72"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.8"/>
      <rect x="139" y="72"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.4"/>
      <rect x="124" y="86"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.5"/>
      <rect x="139" y="86"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.8"/>
      <rect x="124" y="100" width="11" height="9" rx="1" fill="#dbeafe" opacity="0.8"/>
      <rect x="139" y="100" width="11" height="9" rx="1" fill="#dbeafe" opacity="0.4"/>
      <rect x="127" y="132" width="16" height="25" rx="2" fill="#1d4ed8" opacity="0.5"/>
      {/* Hi-rise */}
      <rect x="168" y="16" width="50" height="141" rx="3" fill="#2563eb"/>
      <rect x="176" y="24"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
      <rect x="193" y="24"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.4"/>
      <rect x="176" y="39"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.5"/>
      <rect x="193" y="39"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
      <rect x="176" y="54"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
      <rect x="193" y="54"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.4"/>
      <rect x="176" y="69"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.5"/>
      <rect x="193" y="69"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
      <rect x="176" y="84"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
      <rect x="193" y="84"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.4"/>
      <rect x="179" y="132" width="18" height="25" rx="2" fill="#1e3a8a" opacity="0.7"/>
      <line x1="193" y1="8" x2="193" y2="16" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="193" cy="7" r="3" fill="#60a5fa"/>
      {/* Tick badge */}
      <circle cx="231" cy="149" r="12" fill="#2563eb"/>
      <polyline points="225,149 229,154 237,142" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

export default function Sidebar({ unreadCount }: Props) {
  const user      = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div style={{
      width: 220, background: '#111827',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, height: '100vh',
    }}>
      {/* ── Logo header ── */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <SettlrMark />
        <div>
          <div style={{
            fontSize: 15, fontWeight: 600, color: '#ffffff',
            letterSpacing: '-0.01em', lineHeight: 1,
          }}>
            settlr
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, letterSpacing: '0.06em' }}>
            {user?.role?.name ?? 'PROPERTY CRM'}
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div style={{
              padding: '12px 16px 4px', fontSize: 10, fontWeight: 500,
              color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              {section}
            </div>
            {items.map(({ to, icon, label }) => {
              const isNotifications = to === '/notifications'
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: isActive ? '8px 16px 8px 14px' : '8px 16px',
                    fontSize: 13,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                    textDecoration: 'none',
                    transition: 'background 0.1s, color 0.1s',
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 16 }} />
                    {label}
                  </div>
                  {isNotifications && unreadCount > 0 && (
                    <span style={{
                      background: '#E24B4A', color: '#fff',
                      fontSize: 10, fontWeight: 600,
                      padding: '1px 6px', borderRadius: 99,
                      minWidth: 18, textAlign: 'center', lineHeight: '16px',
                    }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div style={{
        padding: '12px 16px',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#1d4ed8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 500, color: '#fff', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.first_name} {user?.last_name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{user?.email ?? ''}</div>
        </div>
        <button onClick={clearAuth} title="Log out" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.3)' }}>
          <i className="ti ti-logout" style={{ fontSize: 14 }} aria-label="Log out" />
        </button>
      </div>
    </div>
  )
}