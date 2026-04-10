import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './store/auth'
import Layout from './components/Layout'
import Catalog from './pages/Catalog'
import ItemDetail from './pages/ItemDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import MyOrders from './pages/MyOrders'
import MyItems from './pages/MyItems'
import PaymentResult from './pages/PaymentResult'
import './index.css'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

function RequireBuyer() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'buyer') return <Navigate to="/" replace />
  return <Outlet />
}

function RequireSeller() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'seller') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Catalog />} />
              <Route path="/articulo/:id" element={<ItemDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Register />} />

              {/* Payment results */}
              <Route path="/pago/exitoso" element={<PaymentResult type="success" />} />
              <Route path="/pago/fallido" element={<PaymentResult type="failure" />} />
              <Route path="/pago/pendiente" element={<PaymentResult type="pending" />} />

              {/* Buyer protected */}
              <Route element={<RequireBuyer />}>
                <Route path="/mis-compras" element={<MyOrders />} />
              </Route>

              {/* Seller protected */}
              <Route element={<RequireSeller />}>
                <Route path="/mis-articulos" element={<MyItems />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
