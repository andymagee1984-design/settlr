// src/routes/ProtectedRoute.tsx
//
// Handles three states:
//   1. No token — redirect to login immediately
//   2. Token exists but user not loaded — fetch user from /auth/me/ then render
//   3. Token exists and user loaded — render children

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMe } from '../api/auth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user, setAuth, clearAuth } = useAuthStore()
  const [loading, setLoading] = useState(!user && !!accessToken)

  useEffect(() => {
    if (!accessToken || user) return

    // Token exists but user not in store — fetch user (happens on page refresh)
    getMe().then(fetchedUser => {
      setAuth(fetchedUser, accessToken)
      setLoading(false)
    }).catch(() => {
      // Token is invalid/expired — clear and redirect to login
      clearAuth()
      setLoading(false)
    })
  }, [accessToken, user, setAuth, clearAuth])

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f9f6f4',
      }}>
        <div style={{ fontSize: 13, color: '#a89e98' }}>Loading…</div>
      </div>
    )
  }

  return <>{children}</>
}