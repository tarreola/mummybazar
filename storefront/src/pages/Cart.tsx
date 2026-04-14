import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useCart } from '../store/cart'
import { useAuth } from '../store/auth'
import { checkoutCart } from '../api/client'

export default function Cart() {
  const { items, remove, clear, count } = useCart()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const total = items.reduce((s, i) => s + i.price, 0)

  const buyMutation = useMutation({
    mutationFn: () => checkoutCart({
      item_ids: items.map(i => i.id),
      shipping_method: 'pickup',
    }),
    onSuccess: (res) => {
      clear()
      window.location.href = res.data.checkout_url
    },
    onError: (e: any) => {
      const detail = e.response?.data?.detail
      alert(detail || 'Error al procesar el pago. Intenta de nuevo.')
    },
  })

  const handleCheckout = () => {
    if (!isAuthenticated) { navigate('/vende'); return }
    if (user?.role !== 'buyer') {
      alert('Para comprar necesitas una cuenta de compradora, no de vendedora.')
      return
    }
    buyMutation.mutate()
  }

  if (count === 0) return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 560, textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', marginBottom: 8 }}>Tu carrito está vacío</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>Agrega artículos desde el catálogo y vuelve aquí para comprar.</p>
      <Link to="/tienda/catalogo" className="btn btn-primary">Ir al catálogo</Link>
    </div>
  )

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--navy)', margin: 0 }}>Carrito</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            {count} artículo{count !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={clear}
          style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}>
          Vaciar carrito
        </button>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <Link to={`/articulo/${item.id}`} style={{ flexShrink: 0 }}>
              <div style={{ width: 64, height: 80, background: 'var(--navy-light)', borderRadius: 10, overflow: 'hidden' }}>
                {item.image
                  ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.title} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🧸</div>
                }
              </div>
            </Link>

            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/articulo/${item.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
              </Link>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{item.sku}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--navy)' }}>
                ${Number(item.price).toLocaleString('es-MX')}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>MXN</span>
              </div>
            </div>

            <button
              onClick={() => remove(item.id)}
              style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)', cursor: 'pointer', padding: '4px 8px', flexShrink: 0 }}
              title="Quitar">
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Total + checkout */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-light), #fff)', border: '1.5px solid var(--navy-border)', borderRadius: 16, padding: '24px', }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--navy)', lineHeight: 1 }}>
              ${total.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
              <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>MXN</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              {count} artículo{count !== 1 ? 's' : ''} incluido{count !== 1 ? 's' : ''}
            </div>
          </div>
          <a href="https://wa.me/523319537644" target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#16a34a', textDecoration: 'none' }}>
            💬 ¿Dudas?
          </a>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: 17, fontWeight: 800, borderRadius: 12 }}
          onClick={handleCheckout}
          disabled={buyMutation.isPending}
        >
          {buyMutation.isPending
            ? 'Redirigiendo a pago…'
            : `💳 Pagar $${total.toLocaleString('es-MX', { minimumFractionDigits: 0 })} MXN`}
        </button>

        {!isAuthenticated && (
          <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>
            Necesitas{' '}
            <Link to="/vende" style={{ color: 'var(--navy)', fontWeight: 600 }}>iniciar sesión como compradora</Link>
            {' '}para continuar.
          </p>
        )}
      </div>
    </div>
  )
}
