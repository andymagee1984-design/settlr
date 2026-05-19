// src/components/Sidebar.tsx

import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { logout } from '../api/client'

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
    { to: '/projects',   icon: 'ti-building-estate',  label: 'Projects'   },
    { to: '/sales',      icon: 'ti-file-dollar',       label: 'Sales'      },
    { to: '/prospects',  icon: 'ti-users',             label: 'Prospects'  },
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
// Landmarq mini logo mark — slate/terra palette from LoginPage
// ─────────────────────────────────────────────────────────────────────────────

function LandmarqMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 246 190" role="img" aria-label="Landmarq">
      <title>Landmarq</title>
      <rect x="0" y="157" width="246" height="3" rx="1.5" fill="#c0533a" opacity="0.3"/>
      <rect x="0" y="117" width="44" height="40" rx="2" fill="#3d4a5c" opacity="0.55"/>
      <polygon points="22,90 50,117 -6,117" fill="#3d4a5c" opacity="0.8"/>
      <rect x="15" y="133" width="14" height="24" rx="2" fill="#2a3544" opacity="0.7"/>
      <rect x="4" y="122" width="10" height="9" rx="1" fill="#e8ddd8" opacity="0.9"/>
      <rect x="34" y="94" width="5" height="12" rx="1" fill="#3d4a5c" opacity="0.6"/>
      <rect x="52" y="98" width="28" height="59" rx="2" fill="#3d4a5c" opacity="0.65"/>
      <rect x="82" y="106" width="28" height="51" rx="2" fill="#3d4a5c" opacity="0.5"/>
      <rect x="52" y="93" width="28" height="7" rx="1" fill="#3d4a5c" opacity="0.4"/>
      <rect x="82" y="101" width="28" height="7" rx="1" fill="#3d4a5c" opacity="0.35"/>
      <rect x="60" y="128" width="12" height="29" rx="2" fill="#2a3544" opacity="0.65"/>
      <rect x="90" y="128" width="12" height="29" rx="2" fill="#2a3544" opacity="0.55"/>
      <rect x="56" y="104" width="9" height="8" rx="1" fill="#e8ddd8" opacity="0.7"/>
      <rect x="86" y="110" width="9" height="8" rx="1" fill="#e8ddd8" opacity="0.7"/>
      <rect x="56" y="116" width="9" height="8" rx="1" fill="#e8ddd8" opacity="0.4"/>
      <rect x="86" y="118" width="9" height="8" rx="1" fill="#e8ddd8" opacity="0.4"/>
      <rect x="118" y="64" width="42" height="93" rx="2" fill="#3d4a5c" opacity="0.85"/>
      <rect x="118" y="57" width="42" height="9" rx="1" fill="#3d4a5c" opacity="0.5"/>
      <rect x="124" y="72" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="139" y="72" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.35"/>
      <rect x="124" y="86" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.5"/>
      <rect x="139" y="86" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="124" y="100" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="139" y="100" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.35"/>
      <rect x="124" y="114" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.5"/>
      <rect x="139" y="114" width="11" height="9" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="127" y="133" width="16" height="24" rx="2" fill="#2a3544" opacity="0.7"/>
      <rect x="168" y="16" width="50" height="141" rx="2" fill="#3d4a5c"/>
      <rect x="176" y="24" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="193" y="24" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.3"/>
      <rect x="176" y="39" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.5"/>
      <rect x="193" y="39" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="176" y="54" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="193" y="54" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.3"/>
      <rect x="176" y="69" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.5"/>
      <rect x="193" y="69" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="176" y="84" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="193" y="84" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.3"/>
      <rect x="176" y="99" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.5"/>
      <rect x="193" y="99" width="13" height="10" rx="1" fill="#e8ddd8" opacity="0.8"/>
      <rect x="179" y="132" width="18" height="25" rx="2" fill="#2a3544" opacity="0.75"/>
      <line x1="193" y1="6" x2="193" y2="16" stroke="#c0533a" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="193" cy="5" r="3.5" fill="#c0533a"/>
      <circle cx="231" cy="149" r="13" fill="#c0533a"/>
      <polyline points="225,149 229,154 238,142" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

export default function Sidebar({ unreadCount }: Props) {
  const user = useAuthStore((s) => s.user)

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div style={{
      width: 220, background: '#2a3544',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, height: '100vh',
    }}>
      {/* ── Logo header ── */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <LandmarqMark />
        <div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: '#f9f6f4',
            letterSpacing: '-0.5px', lineHeight: 1,
          }}>
            landmarq
          </div>
          <div style={{ fontSize: 10, color: '#c0533a', marginTop: 3, letterSpacing: '0.06em', fontWeight: 500 }}>
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
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderLeft: isActive ? '2px solid #c0533a' : '2px solid transparent',
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
                      background: '#c0533a', color: '#fff',
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
          width: 28, height: 28, borderRadius: '50%', background: '#c0533a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.first_name} {user?.last_name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {user?.email ?? ''}
          </div>
        </div>
        <button
          onClick={logout}
          title="Log out"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'rgba(255,255,255,0.30)', transition: 'color 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
        >
          <i className="ti ti-logout" style={{ fontSize: 14 }} aria-label="Log out" />
        </button>
      </div>
    </div>
  )
}