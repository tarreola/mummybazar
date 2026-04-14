import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useCart } from '../store/cart'
import { useAuth } from '../store/auth'
import { checkout } from '../api/client'

export default function Cart() {
  const { items, remove, clear, count } = useCart()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [checkingOut, setCheckingOut] = useState<number | null>(null) // item id being checked out
  const [error, setError] = useState('')

  const total = items.reduce((s, i) => s + i.price, 0)

  const buyMutation = useMutation({
    mutationFn: ({ itemId }: { itemId: number }) =>
      checkout({ item_id: itemId, shipping_method: 'pickup' }),
    onMutate: ({ itemId }) => { setCheckingOut(itemId); setError('') },
    onSuccess: (res) => {
      window.location.href = res.data.checkout_url
    },
    onError: (e: any) => {
      setCheckingOut(null)
      setError(e.response?.data?.detail || 'Error al procesar el pago. Intenta de nuevo.')
    },
  })

  const handleBuy = (itemId: number) => {
    if (!isAuthenticated) { navigate('/vende'); return }
    if (user?.role !== 'buyer') { setError('Solo las compradoras pueden realizar compras.'); return }
    buyMutation.mutate({ itemId })
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--navy)', margin: 0 }}>Carrito</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            {count} artículo{count !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={clear} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}>
          Vaciar carrito
        </button>
      </div>

      {error && (
        <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#cf1322' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
            {/* Thumb */}
            <Link to={`/articulo/${item.id}`} style={{ flexShrink: 0 }}>
              <div style={{ width: 64, height: 80, background: 'var(--navy-light)', borderRadius: 10, overflow: 'hidden' }}>
                {item.image
                  ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.title} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🧸</div>
                }
              </div>
            </Link>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/articulo/${item.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
              </Link>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{item.sku}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--navy)' }}>
                ${Number(item.price).toLocaleString('es-MX')} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>MXN</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleBuy(item.id)}
                disabled={checkingOut === item.id}
                style={{ minWidth: 110, justifyContent: 'center' }}
              >
                {checkingOut === item.id ? 'Redirigiendo…' : '💳 Comprar ahora'}
              </button>
              <button
                onClick={() => remove(item.id)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', textAlign: 'right' }}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-light), #fff)', border: '1.5px solid var(--navy-border)', borderRadius: 14, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Total estimado</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy)' }}>
            ${total.toLocaleString('es-MX')} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>MXN</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Cada artículo se compra por separado con MercadoPago
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>¿Dudas? Escríbenos</div>
          <a href="https://wa.me/523319537644" target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#16a34a', textDecoration: 'none' }}>
            💬 WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
