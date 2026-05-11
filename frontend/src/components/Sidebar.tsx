import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/',          icon: 'ti-layout-dashboard', label: 'Dashboard' },
    ],
  },
  {
    section: 'Main',
    items: [
      { to: '/projects',  icon: 'ti-building-estate',  label: 'Projects' },
      { to: '/sales',     icon: 'ti-file-dollar',       label: 'Sales' },
    ],
  },
  {
    section: 'People',
    items: [
      { to: '/contacts',  icon: 'ti-users',             label: 'Contacts' },
      { to: '/agencies',  icon: 'ti-building',          label: 'Agencies' },
    ],
  },
  {
    section: 'Insights',
    items: [
      { to: '/reports',    icon: 'ti-chart-bar',        label: 'Reports' },
      { to: '/activities', icon: 'ti-checkbox',         label: 'Activities' },
    ],
  },
]

export default function Sidebar() {
  const user      = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div
      style={{
        width: 220,
        background: '#111827',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
      }}
    >
      <div
        style={{
          padding: '20px 16px 12px',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Property CRM
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          {user?.role?.name ?? ''}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div
              style={{
                padding: '12px 16px 4px',
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.28)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {section}
            </div>
            {items.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isActive ? '8px 16px 8px 14px' : '8px 16px',
                  fontSize: 13,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  textDecoration: 'none',
                })}
              >
                <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 16 }} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '0.5px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 500,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.first_name} {user?.last_name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {user?.email ?? ''}
          </div>
        </div>
        <button
          onClick={clearAuth}
          title="Log out"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          <i className="ti ti-logout" style={{ fontSize: 14 }} aria-label="Log out" />
        </button>
      </div>
    </div>
  )
}