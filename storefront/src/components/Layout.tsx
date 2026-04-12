import { Link, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../store/auth'

const NAVY = '#1a3a6b'
const RED  = '#d42b2b'

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: '2px solid #c8d8f0',
        position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(26,58,107,.08)',
      }}>
        <div className="container" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60, gap: 16,
        }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="El Ropero de Mar" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          </Link>

          {/* Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', padding: '6px 10px' }}>
              Inicio
            </Link>
            <Link to="/catalogo" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', padding: '6px 10px' }}>
              Catálogo
            </Link>
            <Link to="/seguimiento" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', padding: '6px 10px' }}>
              📦 Mi pedido
            </Link>

            {!isAuthenticated ? (
              <>
                <Link to="/login" className="btn btn-outline btn-sm">Vendedoras</Link>
              </>
            ) : (
              <>
                {user?.role === 'seller' && (
                  <Link to="/mis-articulos" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', padding: '6px 10px' }}>
                    Mis artículos
                  </Link>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Hola, {user?.name.split(' ')[0]}
                    {!user?.is_approved && (
                      <span className="tag tag-orange" style={{ marginLeft: 6 }}>Pendiente aprobación</span>
                    )}
                  </span>
                  <button onClick={handleLogout} className="btn btn-outline btn-sm">Salir</button>
                </div>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer style={{
        background: NAVY, borderTop: '1px solid #2e5fa3',
        padding: '28px 16px', textAlign: 'center', marginTop: 40,
        color: '#fff',
      }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>el ropero de </span>
          <span style={{ color: '#f87171', fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>MAR</span>
        </div>
        <div style={{ fontSize: 12, color: '#93b4e0' }}>
          Ropa y accesorios para bebé y niños · Ciudad de México
        </div>
        <div style={{ fontSize: 12, color: '#93b4e0', marginTop: 4 }}>
          ¿Tienes dudas? Escríbenos por{' '}
          <a href="https://wa.me/523319537644" style={{ color: '#4ade80', fontWeight: 600 }}>
            WhatsApp
          </a>
        </div>
      </footer>
    </div>
  )
}
