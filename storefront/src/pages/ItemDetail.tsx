import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getItem, checkout } from '../api/client'
import { useAuth } from '../store/auth'

const CATEGORY: Record<string, string> = {
  clothing: 'Ropa', furniture: 'Muebles', lactancy: 'Lactancia',
  strollers: 'Carriolas', toys: 'Juguetes', accessories: 'Accesorios', other: 'Otro',
}
const CONDITION: Record<string, string> = {
  like_new: 'Como nuevo ✨', good: 'Buen estado 👍', fair: 'Estado regular',
}
const CONDITION_TAG: Record<string, string> = {
  like_new: 'tag-green', good: 'tag-blue', fair: 'tag-orange',
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [activePhoto, setActivePhoto] = useState(0)
  const [shipping, setShipping] = useState('pickup')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  const { data: item, isLoading } = useQuery({
    queryKey: ['sf-item', id],
    queryFn: () => getItem(Number(id)).then(r => r.data),
  })

  const buyMutation = useMutation({
    mutationFn: (data: object) => checkout(data),
    onSuccess: (res) => {
      // Redirect to MercadoPago checkout
      window.location.href = res.data.checkout_url
    },
    onError: (e: any) => {
      setError(e.response?.data?.detail || 'Error al procesar el pago. Intenta de nuevo.')
    },
  })

  const handleBuy = () => {
    setError('')
    if (!isAuthenticated) { navigate('/login?redirect=' + encodeURIComponent(`/articulo/${id}`)); return }
    if (user?.role !== 'buyer') { setError('Solo las compradoras pueden realizar compras.'); return }
    buyMutation.mutate({
      item_id: Number(id),
      shipping_method: shipping,
      shipping_address: shipping !== 'pickup' ? address : undefined,
    })
  }

  if (isLoading) return <div className="spinner" style={{ marginTop: 80 }} />

  if (!item) return (
    <div className="container" style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>Artículo no disponible</div>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
        Ver catálogo
      </Link>
    </div>
  )

  const images: string[] = item.images || []

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <Link to="/" style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        ← Volver al catálogo
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

        {/* ── Photos ── */}
        <div>
          <div style={{
            aspectRatio: '4/5', borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--pink-border)', background: '#fafafa',
          }}>
            {images.length > 0 ? (
              <img src={images[activePhoto]} alt={item.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, background: 'var(--pink-light)' }}>🧸</div>
            )}
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {images.map((url, i) => (
                <div key={i} onClick={() => setActivePhoto(i)}
                  style={{
                    width: 60, height: 75, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    border: `2px solid ${i === activePhoto ? 'var(--pink)' : 'var(--pink-border)'}`,
                  }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div>
          {item.is_featured && (
            <span style={{ background: 'var(--pink)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, display: 'inline-block', marginBottom: 8 }}>
              ⭐ Artículo destacado
            </span>
          )}

          <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 8 }}>{item.title}</h1>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className={`tag ${CONDITION_TAG[item.condition] || 'tag-gray'}`}>
              {CONDITION[item.condition] || item.condition}
            </span>
            <span className="tag tag-pink">{CATEGORY[item.category] || item.category}</span>
            {item.size && <span className="tag tag-gray">Talla: {item.size}</span>}
            {item.brand && <span className="tag tag-gray">{item.brand}</span>}
            {item.color && <span className="tag tag-gray">{item.color}</span>}
          </div>

          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--pink)', marginBottom: 4 }}>
            ${Number(item.selling_price).toLocaleString('es-MX')} <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted)' }}>MXN</span>
          </div>
          {item.original_price && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Precio original:{' '}
              <span style={{ textDecoration: 'line-through' }}>
                ${Number(item.original_price).toLocaleString('es-MX')}
              </span>
              {' '}· Ahorras ${(Number(item.original_price) - Number(item.selling_price)).toLocaleString('es-MX')}
            </div>
          )}

          {item.description && (
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 20 }}>
              {item.description}
            </p>
          )}

          {/* ── Shipping selector ── */}
          <div style={{ background: 'var(--pink-light)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📦 Método de entrega</div>
            {[
              { value: 'pickup', label: '📍 Recoger en punto de entrega (CDMX)' },
              { value: 'delivery_cdmx', label: '🛵 Entrega a domicilio en CDMX' },
              { value: 'parcel', label: '📬 Paquetería a todo México' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" name="shipping" value={opt.value}
                  checked={shipping === opt.value}
                  onChange={() => setShipping(opt.value)} />
                {opt.label}
              </label>
            ))}
            {shipping !== 'pickup' && (
              <input type="text" placeholder="Calle, colonia, ciudad, CP"
                value={address} onChange={e => setAddress(e.target.value)}
                style={{
                  width: '100%', marginTop: 8, padding: '8px 10px',
                  border: '1.5px solid var(--pink-border)', borderRadius: 8,
                  fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }} />
            )}
          </div>

          {error && (
            <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#cf1322' }}>
              {error}
            </div>
          )}

          {/* ── CTA ── */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: 16, marginBottom: 10 }}
            onClick={handleBuy}
            disabled={buyMutation.isPending}
          >
            {buyMutation.isPending ? 'Redirigiendo a pago…' : '💳 Comprar ahora — MercadoPago'}
          </button>

          {!isAuthenticated && (
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Necesitas{' '}
              <Link to={`/login?redirect=${encodeURIComponent('/articulo/' + id)}`} style={{ color: 'var(--pink)', fontWeight: 600 }}>
                iniciar sesión
              </Link>
              {' '}o{' '}
              <Link to="/registro" style={{ color: 'var(--pink)', fontWeight: 600 }}>registrarte</Link>
              {' '}para comprar.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <a href="https://wa.me/525500000000" target="_blank" rel="noreferrer"
              className="btn btn-green btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
              💬 Preguntar por WhatsApp
            </a>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, textAlign: 'center' }}>
            SKU: {item.sku} · Pago 100% seguro con MercadoPago
          </div>
        </div>
      </div>

      {/* Mobile: stack columns on small screens */}
      <style>{`
        @media (max-width: 640px) {
          .item-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
