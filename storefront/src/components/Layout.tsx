import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'

const TIENDA_ITEMS = [
  { to: '/tienda/catalogo',   label: '🗂️ Catálogo completo' },
  { to: '/tienda/descuentos', label: '🏷️ Descuentos' },
  { to: '/tienda/ropa',       label: '👗 Ropa' },
  { to: '/tienda/muebles',    label: '🛋️ Muebles' },
  { to: '/tienda/lactancia',  label: '🍼 Lactancia' },
  { to: '/tienda/carriolas',  label: '🚼 Carriolas' },
  { to: '/tienda/juguetes',   label: '🧸 Juguetes' },
  { to: '/tienda/accesorios', label: '🎀 Accesorios y Otros' },
]

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [tiendaOpen, setTiendaOpen] = useState(false)

  const dropRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => { logout(); navigate('/') }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setTiendaOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setTiendaOpen(false) }, [location.pathname])

  const navLink = (to: string, label: string) => (
    <Link to={to} style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', padding: '6px 10px', whiteSpace: 'nowrap' }}>{label}</Link>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#fff', borderBottom: '2px solid var(--navy-border)', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(26,58,107,.08)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, gap: 16 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src="/logo.png" alt="El Ropero de Mar" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          </Link>

          {/* Desktop Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
            {/* Tienda dropdown */}
            <div ref={dropRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setTiendaOpen(o => !o)}
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', padding: '8px 14px', background: tiendaOpen ? 'var(--navy-light)' : 'transparent', border: '1.5px solid ' + (tiendaOpen ? 'var(--navy-border)' : 'transparent'), borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                Tienda <span style={{ fontSize: 10, transition: 'transform .2s', display: 'inline-block', transform: tiendaOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
              </button>
              {tiendaOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1px solid var(--navy-border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(26,58,107,.12)', minWidth: 220, padding: '6px 0', zIndex: 200 }}>
                  {TIENDA_ITEMS.map(item => (
                    <Link key={item.to} to={item.to}
                      style={{ display: 'block', padding: '9px 18px', fontSize: 14, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--navy-light)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {navLink('/vende', 'Vende')}
            {navLink('/seguimiento', '📦 Mi pedido')}

            {isAuthenticated && user?.role === 'seller' && navLink('/vende', 'Mis artículos')}
          </nav>

          {/* Right: cart + auth */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Cart */}
            <Link to="/carrito" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, border: '1.5px solid var(--navy-border)', background: count > 0 ? 'var(--navy-light)' : '#fff', color: 'var(--navy)', fontSize: 18 }}>
              🛒
              {count > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--navy)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {count}
                </span>
              )}
            </Link>

            {/* Auth */}
            {!isAuthenticated ? (
              <Link to="/vende" className="btn btn-outline btn-sm">Soy vendedora</Link>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Hola, {user?.name.split(' ')[0]}</span>
                <button onClick={handleLogout} className="btn btn-outline btn-sm">Salir</button>
              </div>
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
            {TIENDA_ITEMS.map(i => <Link key={i.to} to={i.to} style={{ display: 'block', fontSize: 13, color: '#93b4e0', marginBottom: 6 }}>{i.label}</Link>)}
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
