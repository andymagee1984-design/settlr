// src/features/auth/LoginPage.tsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getMe } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

// ─────────────────────────────────────────────────────────────────────────────
// Settlr logo — full skyline mark + wordmark
// ─────────────────────────────────────────────────────────────────────────────

function SettlrLogo() {
  return (
    <svg width="440" height="144" viewBox="0 0 680 220" role="img" aria-label="Settlr">
      <title>Settlr</title>

      {/* ── Skyline mark ── */}
      <g transform="translate(34, 16)">
        {/* Ground */}
        <rect x="0" y="154" width="246" height="3" rx="1.5" fill="#3b82f6" opacity="0.25"/>

        {/* Single dwelling — far left */}
        <rect x="0" y="114" width="44" height="40" rx="2" fill="#93c5fd" opacity="0.7"/>
        <polygon points="22,88 48,114 -4,114" fill="#60a5fa" opacity="0.8"/>
        <rect x="15" y="130" width="14" height="24" rx="2" fill="#1d4ed8" opacity="0.6"/>
        <rect x="4" y="122" width="10" height="9" rx="1" fill="#dbeafe" opacity="0.9"/>
        <line x1="9" y1="122" x2="9" y2="131" stroke="#93c5fd" stroke-width="0.8"/>
        <line x1="4" y1="126" x2="14" y2="126" stroke="#93c5fd" stroke-width="0.8"/>
        <rect x="34" y="91" width="6" height="12" rx="1" fill="#60a5fa" opacity="0.7"/>

        {/* Townhouses */}
        <rect x="52" y="96" width="28" height="58" rx="2" fill="#60a5fa" opacity="0.75"/>
        <rect x="82" y="104" width="28" height="50" rx="2" fill="#60a5fa" opacity="0.6"/>
        <rect x="52" y="92" width="28" height="5" rx="1" fill="#3b82f6" opacity="0.7"/>
        <rect x="82" y="100" width="28" height="5" rx="1" fill="#3b82f6" opacity="0.6"/>
        <rect x="60" y="126" width="12" height="28" rx="2" fill="#1d4ed8" opacity="0.5"/>
        <rect x="90" y="126" width="12" height="28" rx="2" fill="#1d4ed8" opacity="0.4"/>
        <rect x="56" y="104" width="9" height="7" rx="1" fill="#dbeafe" opacity="0.8"/>
        <rect x="68" y="104" width="9" height="7" rx="1" fill="#dbeafe" opacity="0.4"/>
        <rect x="86" y="110" width="9" height="7" rx="1" fill="#dbeafe" opacity="0.8"/>
        <rect x="98" y="110" width="9" height="7" rx="1" fill="#dbeafe" opacity="0.4"/>

        {/* Mid-rise apartment */}
        <rect x="118" y="62" width="42" height="92" rx="3" fill="#3b82f6" opacity="0.85"/>
        <rect x="124" y="70"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.8"/>
        <rect x="139" y="70"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.4"/>
        <rect x="124" y="84"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.5"/>
        <rect x="139" y="84"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.8"/>
        <rect x="124" y="98"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.8"/>
        <rect x="139" y="98"  width="11" height="9" rx="1" fill="#dbeafe" opacity="0.4"/>
        <rect x="124" y="112" width="11" height="9" rx="1" fill="#dbeafe" opacity="0.5"/>
        <rect x="139" y="112" width="11" height="9" rx="1" fill="#dbeafe" opacity="0.8"/>
        <rect x="127" y="130" width="16" height="24" rx="2" fill="#1d4ed8" opacity="0.5"/>
        <rect x="122" y="57" width="34" height="7" rx="2" fill="#2563eb" opacity="0.7"/>

        {/* Hi-rise tower */}
        <rect x="168" y="14" width="50" height="140" rx="3" fill="#2563eb"/>
        <rect x="176" y="22"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
        <rect x="193" y="22"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.4"/>
        <rect x="176" y="37"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.5"/>
        <rect x="193" y="37"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
        <rect x="176" y="52"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
        <rect x="193" y="52"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.4"/>
        <rect x="176" y="67"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.5"/>
        <rect x="193" y="67"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
        <rect x="176" y="82"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
        <rect x="193" y="82"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.4"/>
        <rect x="176" y="97"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.5"/>
        <rect x="193" y="97"  width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
        <rect x="176" y="112" width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.8"/>
        <rect x="193" y="112" width="13" height="10" rx="1" fill="#bfdbfe" opacity="0.4"/>
        <rect x="179" y="130" width="18" height="24" rx="2" fill="#1e3a8a" opacity="0.7"/>
        <line x1="193" y1="6" x2="193" y2="14" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
        <circle cx="193" cy="5" r="2.5" fill="#60a5fa"/>

        {/* Settle tick badge */}
        <circle cx="231" cy="146" r="11" fill="#2563eb"/>
        <polyline points="225,146 229,151 237,139" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      {/* ── Divider ── */}
      <line x1="302" y1="24" x2="302" y2="186" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>

      {/* ── Wordmark ── */}
      <text x="322" y="138"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 500, fontSize: 72, fill: '#ffffff', letterSpacing: '-1px' }}>
        settlr
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Login page
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokens = await login({ email, password })
      sessionStorage.setItem('access_token', tokens.access)
      const user = await getMe()
      setAuth(user, tokens.access)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#0f172a',
    }}>

      {/* ── Left panel — branding ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Glow */}
        <div style={{
          position: 'absolute',
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', textAlign: 'center' }}>
          <SettlrLogo />
          <p style={{
            marginTop: 24,
            fontSize: 15,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.02em',
            lineHeight: 1.6,
            maxWidth: 320,
          }}>
            The property CRM built for developers.<br />
            From first lot to final settlement.
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div style={{
        width: 440,
        flexShrink: 0,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: 0 }}>
              Sign in
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '10px 12px', fontSize: 14, color: '#111827',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#2563eb')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '10px 12px', fontSize: 14, color: '#111827',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#2563eb')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#93c5fd' : '#2563eb',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#1d4ed8') }}
              onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = '#2563eb') }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 32, fontSize: 12, color: '#d1d5db', textAlign: 'center' }}>
            Settlr · Property CRM
          </p>
        </div>
      </div>
    </div>
  )
}