import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Board from './pages/Board'
// FullCalendar is most of the bundle; load it only when the calendar opens
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Settings from './pages/Settings'

function Guard() {
  const session = useSession()
  if (session === undefined) return <div className="p-4">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  return <Layout />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/board" element={<Board />} />
        <Route path="/calendar" element={<Suspense fallback={<p>Loading…</p>}><CalendarPage /></Suspense>} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
