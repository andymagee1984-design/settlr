// src/features/auth/LoginPage.tsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getMe } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

function LandmarqLogo({ size = 1 }: { size?: number }) {
  const w = Math.round(246 * size)
  const h = Math.round(190 * size)
  return (
    <svg width={w} height={h} viewBox="0 0 246 190" role="img" aria-label="Landmarq">
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

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('handleSubmit called', email)
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokens = await login({ email, password })
      console.log('login success, fetching user')
      const user = await getMe(tokens.access)
      console.log('getMe success', user)
      setAuth(user, tokens.access)
      navigate('/')
    } catch (err) {
      console.error('login error', err)
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f9f6f4' }}>

      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        background: '#2a3544',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(232,221,216,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,221,216,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div style={{
          position: 'absolute',
          width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(192,83,58,0.12) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <LandmarqLogo size={0.95} />
          <div style={{
            fontSize: 42, fontWeight: 700, letterSpacing: '-1.5px',
            color: '#f9f6f4', marginTop: 8, lineHeight: 1,
          }}>
            landmarq
          </div>
          <div style={{
            fontSize: 11, fontWeight: 500, letterSpacing: '5px',
            color: '#c0533a', marginTop: 8,
          }}>
            PROPERTY CRM
          </div>
          <p style={{
            marginTop: 28, fontSize: 14,
            color: 'rgba(249,246,244,0.4)',
            lineHeight: 1.7, maxWidth: 300,
          }}>
            The property CRM built for developers.<br />
            From first enquiry to final settlement.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        width: 460, flexShrink: 0,
        background: '#f9f6f4',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 48px',
        borderLeft: '1px solid #e8ddd8',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#2a3544', margin: 0, letterSpacing: '-0.5px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: '#7a8a9a', marginTop: 6 }}>
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3d4a5c', marginBottom: 6, letterSpacing: '0.02em' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1.5px solid #ddd4cc', borderRadius: 8,
                  padding: '10px 12px', fontSize: 14, color: '#2a3544',
                  background: '#fff', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#3d4a5c')}
                onBlur={e => (e.target.style.borderColor = '#ddd4cc')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3d4a5c', marginBottom: 6, letterSpacing: '0.02em' }}>
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
                  border: '1.5px solid #ddd4cc', borderRadius: 8,
                  padding: '10px 12px', fontSize: 14, color: '#2a3544',
                  background: '#fff', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#3d4a5c')}
                onBlur={e => (e.target.style.borderColor = '#ddd4cc')}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#c0533a', margin: 0, fontWeight: 500 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#7a8a9a' : '#3d4a5c',
                color: '#f9f6f4', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                transition: 'background 0.15s',
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#2a3544') }}
              onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = '#3d4a5c') }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 36, fontSize: 12, color: '#b0a89e', textAlign: 'center' }}>
            Landmarq · Property CRM
          </p>
        </div>
      </div>
    </div>
  )
}