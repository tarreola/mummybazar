import { Link, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useState } from 'react'

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

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
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--pink)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16,
            }}>M</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--pink)' }}>
              Mommy<span style={{ color: '#262626' }}>Bazar</span>
            </span>
          </Link>

          {/* Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', padding: '6px 10px' }}>
              Catálogo
            </Link>

            {!isAuthenticated ? (
              <>
                <Link to="/login" className="btn btn-outline btn-sm">Iniciar sesión</Link>
                <Link to="/registro" className="btn btn-primary btn-sm">Registrarme</Link>
              </>
            ) : (
              <>
                {user?.role === 'buyer' && (
                  <Link to="/mis-compras" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', padding: '6px 10px' }}>
                    Mis compras
                  </Link>
                )}
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
