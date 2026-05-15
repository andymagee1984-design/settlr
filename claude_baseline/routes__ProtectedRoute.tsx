import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = sessionStorage.getItem('access_token')

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />
  }

  return children ? <>{children}</> : <Outlet />
}