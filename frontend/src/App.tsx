import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ContactsPage from './features/contacts/ContactsPage'
import AgenciesPage from './features/contacts/AgenciesPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './features/auth/LoginPage'
import ActivitiesPage from './features/activities/ActivitiesPage'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './components/Layout'
import ProjectsPage from './features/projects/ProjectsPage'
import SalesPage from './features/sales/SalesPage'

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
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/agencies" element={<AgenciesPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}