import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './features/auth/LoginPage'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './components/Layout'
import ProjectsPage from './features/projects/ProjectsPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/sales" element={<div style={{ padding: '2rem' }}><h1>Sales</h1></div>} />
            <Route path="/contacts" element={<div style={{ padding: '2rem' }}><h1>Contacts</h1></div>} />
            <Route path="/agencies" element={<div style={{ padding: '2rem' }}><h1>Agencies</h1></div>} />
            <Route path="/activities" element={<div style={{ padding: '2rem' }}><h1>Activities</h1></div>} />
          </Route>
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}