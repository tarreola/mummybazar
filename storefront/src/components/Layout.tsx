import { useEffect } from 'react'
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'

const NAV_ITEMS = [
  { to: '/tienda/catalogo',   label: 'Catálogo' },
  { to: '/tienda/descuentos', label: 'Descuentos' },
  { to: '/tienda/ropa',       label: 'Ropa' },
  { to: '/tienda/muebles',    label: 'Muebles' },
  { to: '/tienda/lactancia',  label: 'Lactancia' },
  { to: '/tienda/carriolas',  label: 'Carriolas' },
  { to: '/tienda/juguetes',   label: 'Juguetes' },
  { to: '/tienda/accesorios', label: 'Accesorios' },
]

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => { logout(); navigate('/') }

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar: logo + right auth */}
      <header style={{ background: '#fff', borderBottom: '2px solid var(--navy-border)', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(26,58,107,.08)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, gap: 16 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src="/logo.png" alt="El Ropero de Mar" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
          </Link>

          {/* Center: categories */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center', overflowX: 'auto' }}>
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: location.pathname === item.to ? 'var(--navy)' : 'var(--text)',
                  padding: '5px 9px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  background: location.pathname === item.to ? 'var(--navy-light)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: cart + auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Cart */}
            <Link
              to="/carrito"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 10, border: '1.5px solid var(--navy-border)', background: count > 0 ? 'var(--navy-light)' : '#fff', color: 'var(--navy)', fontSize: 17, textDecoration: 'none' }}
            >
              🛒
              {count > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--navy)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {count}
                </span>
              )}
            </Link>

            {/* Auth area */}
            {!isAuthenticated ? (
              <Link to="/vende" className="btn btn-outline btn-sm" style={{ fontSize: 13 }}>Vende</Link>
            ) : (
              <>
                <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Hola, {user?.name.split(' ')[0]}</span>
                <Link to="/vende" className="btn btn-outline btn-sm" style={{ fontSize: 13 }}>Mi Cuenta</Link>
                <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ fontSize: 13 }}>Salir</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{ background: 'var(--navy)', borderTop: '1px solid #2e5fa3', padding: '32px 16px', marginTop: 40 }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 24 }}>
          <div>
            <img src="/logo.png" alt="El Ropero de Mar" style={{ height: 44, marginBottom: 10, filter: 'brightness(0) invert(1)' }} />
            <p style={{ fontSize: 13, color: '#93b4e0', lineHeight: 1.6 }}>Ropa y accesorios de bebé y niños · Ciudad de México</p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Tienda</div>
            {NAV_ITEMS.map(i => (
              <Link key={i.to} to={i.to} style={{ display: 'block', fontSize: 13, color: '#93b4e0', marginBottom: 6, textDecoration: 'none' }}>{i.label}</Link>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Contacto</div>
            <a href="https://wa.me/523319537644" style={{ display: 'block', fontSize: 13, color: '#4ade80', marginBottom: 6, fontWeight: 600 }}>💬 WhatsApp</a>
            <div style={{ fontSize: 13, color: '#93b4e0' }}>¿Dudas? Escríbenos,<br />con gusto te ayudamos 🌸</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #2e5fa3', paddingTop: 16, textAlign: 'center', fontSize: 12, color: '#93b4e0' }}>
          © 2025 El Ropero de Mar — Todos los derechos reservados
        </div>
      </footer>
    </div>
  )
}
