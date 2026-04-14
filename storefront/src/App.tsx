import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './store/auth'
import { CartProvider } from './store/cart'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Catalog from './pages/Catalog'
import ItemDetail from './pages/ItemDetail'
import CategoryPage from './pages/CategoryPage'
import Descuentos from './pages/Descuentos'
import Vende from './pages/Vende'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Seguimiento from './pages/Seguimiento'
import PaymentResult from './pages/PaymentResult'
import MyItems from './pages/MyItems'
import './index.css'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

function RequireSeller() {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/vende" replace />
  if (user?.role !== 'seller') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Landing />} />

                {/* Tienda */}
                <Route path="/catalogo" element={<Navigate to="/tienda/catalogo" replace />} />
                <Route path="/tienda/catalogo"   element={<Catalog />} />
                <Route path="/tienda/descuentos" element={<Descuentos />} />
                <Route path="/tienda/ropa"        element={<CategoryPage category="clothing" />} />
                <Route path="/tienda/muebles"     element={<CategoryPage category="furniture" />} />
                <Route path="/tienda/lactancia"   element={<CategoryPage category="lactancy" />} />
                <Route path="/tienda/carriolas"   element={<CategoryPage category="strollers" />} />
                <Route path="/tienda/juguetes"    element={<CategoryPage category="toys" />} />
                <Route path="/tienda/accesorios"  element={<CategoryPage category="accessories" />} />

                {/* Item detail */}
                <Route path="/articulo/:id" element={<ItemDetail />} />

                {/* Vende */}
                <Route path="/vende" element={<Vende />} />
                <Route path="/login" element={<Navigate to="/vende" replace />} />
                <Route path="/registro" element={<Navigate to="/vende" replace />} />

                {/* Cart + Checkout */}
                <Route path="/carrito" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />

                {/* Tracking */}
                <Route path="/seguimiento" element={<Seguimiento />} />

                {/* Payment */}
                <Route path="/pago/exitoso"   element={<PaymentResult type="success" />} />
                <Route path="/pago/fallido"   element={<PaymentResult type="failure" />} />
                <Route path="/pago/pendiente" element={<PaymentResult type="pending" />} />

                {/* Seller protected */}
                <Route element={<RequireSeller />}>
                  <Route path="/mis-articulos" element={<MyItems />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
