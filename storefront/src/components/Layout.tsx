import { Link, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header style={{
        background: '#fff', borderBottom: '1px solid var(--pink-border)',
        position: 'sticky', top: 0, zIndex: 100, boxShadow: 'var(--shadow)',
      }}>
        <div className="container" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60, gap: 16,
        }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>🌸</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--pink)', lineHeight: 1 }}>
              MommyBazar
            </span>
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
        background: '#fff', borderTop: '1px solid var(--pink-border)',
        padding: '24px 16px', textAlign: 'center', marginTop: 40,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--pink)', marginBottom: 4 }}>MommyBazar 🌸</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Artículos de bebé y niños con mucho amor · Ciudad de México
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          ¿Tienes dudas? Escríbenos por{' '}
          <a href="https://wa.me/525500000000" style={{ color: '#25d366', fontWeight: 600 }}>
            WhatsApp
          </a>
        </div>
      </footer>
    </div>
  )
}
