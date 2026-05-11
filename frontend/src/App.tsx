import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './features/auth/LoginPage'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './components/Layout'
import DashboardPage from './features/dashboard/DashboardPage'
import ProjectsPage from './features/projects/ProjectsPage'
import ProjectDetailPage from './features/projects/ProjectDetailPage'
import SalesPage from './features/sales/SalesPage'
import ContactsPage from './features/contacts/ContactsPage'
import AgenciesPage from './features/contacts/AgenciesPage'
import ActivitiesPage from './features/activities/ActivitiesPage'
import ReportsPage from './features/reports/ReportsPage'

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
            <Route index element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/agencies" element={<AgenciesPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}