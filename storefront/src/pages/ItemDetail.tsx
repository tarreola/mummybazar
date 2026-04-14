import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getItem } from '../api/client'
import { useCart } from '../store/cart'
import ItemSlideshow from '../components/ItemSlideshow'

const CATEGORY: Record<string, string> = {
  clothing: 'Ropa', furniture: 'Muebles', lactancy: 'Lactancia',
  strollers: 'Carriolas', toys: 'Juguetes', accessories: 'Accesorios', other: 'Otro',
}
const CATEGORY_LINK: Record<string, string> = {
  clothing: '/tienda/ropa', furniture: '/tienda/muebles', lactancy: '/tienda/lactancia',
  strollers: '/tienda/carriolas', toys: '/tienda/juguetes', accessories: '/tienda/accesorios',
}
const CONDITION: Record<string, string> = {
  like_new: 'Como nuevo ✨', good: 'Buen estado 👍', fair: 'Estado regular',
}
const CONDITION_TAG: Record<string, string> = {
  like_new: 'tag-green', good: 'tag-blue', fair: 'tag-orange',
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const { add, remove, has } = useCart()
  const [activePhoto, setActivePhoto] = useState(0)
  const [cartMsg, setCartMsg] = useState('')

  const { data: item, isLoading } = useQuery({
    queryKey: ['sf-item', id],
    queryFn: () => getItem(Number(id)).then(r => r.data),
  })

  const inCart = item ? has(item.id) : false

  const handleCart = () => {
    if (!item) return
    if (inCart) {
      remove(item.id)
      setCartMsg('')
    } else {
      add({
        id: item.id,
        title: item.title,
        price: Number(item.selling_price),
        image: item.images?.[0],
        sku: item.sku,
      })
      setCartMsg('✅ Agregado al carrito')
      setTimeout(() => setCartMsg(''), 3000)
    }
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
  const hasDiscount = item.original_price && Number(item.original_price) > Number(item.selling_price)
  const discountPct = hasDiscount
    ? Math.round((1 - Number(item.selling_price) / Number(item.original_price)) * 100)
    : 0

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 64 }}>
      <Link to={CATEGORY_LINK[item.category] || '/'} style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20, textDecoration: 'none' }}>
        ← {CATEGORY[item.category] || 'Catálogo'}
      </Link>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 40, alignItems: 'start' }}>

        {/* ── Photos (reduced 25%) ── */}
        <div style={{ maxWidth: 380 }}>
          <div style={{
            aspectRatio: '4/5', borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--navy-border)', background: '#fafafa', position: 'relative',
          }}>
            {images.length > 0 ? (
              <img src={images[activePhoto]} alt={item.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, background: 'var(--navy-light)' }}>🧸</div>
            )}
            {hasDiscount && (
              <span style={{ position: 'absolute', top: 10, left: 10, background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>
                -{discountPct}%
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {images.map((url, i) => (
                <div key={i} onClick={() => setActivePhoto(i)}
                  style={{
                    width: 52, height: 65, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    border: `2px solid ${i === activePhoto ? 'var(--navy)' : 'var(--navy-border)'}`,
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
            <span style={{ background: 'var(--navy)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, display: 'inline-block', marginBottom: 10 }}>
              ⭐ Artículo destacado
            </span>
          )}

          <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 10, color: 'var(--navy)' }}>{item.title}</h1>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className={`tag ${CONDITION_TAG[item.condition] || 'tag-gray'}`}>
              {CONDITION[item.condition] || item.condition}
            </span>
            <span className="tag tag-pink">{CATEGORY[item.category] || item.category}</span>
            {item.size && <span className="tag tag-gray">Talla: {item.size}</span>}
            {item.brand && <span className="tag tag-gray">{item.brand}</span>}
            {item.color && <span className="tag tag-gray">{item.color}</span>}
          </div>

          {/* Price */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--navy)', lineHeight: 1 }}>
              ${Number(item.selling_price).toLocaleString('es-MX')}
              <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>MXN</span>
            </div>
            {hasDiscount && (
              <div style={{ fontSize: 14, color: 'var(--muted)', textDecoration: 'line-through', marginTop: 4 }}>
                Antes: ${Number(item.original_price).toLocaleString('es-MX')}
              </div>
            )}
          </div>

          {item.description && (
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 22, borderLeft: '3px solid var(--navy-border)', paddingLeft: 12 }}>
              {item.description}
            </p>
          )}

          {/* Cart button */}
          <button
            className={inCart ? 'btn btn-outline' : 'btn btn-primary'}
            style={{ width: '100%', padding: '14px', fontSize: 16, marginBottom: 10, fontWeight: 700 }}
            onClick={handleCart}
          >
            {inCart ? '✓ Quitar del carrito' : '🛒 Agregar al carrito'}
          </button>

          {cartMsg && (
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#389e0d', marginBottom: 10, textAlign: 'center' }}>
              {cartMsg} — <Link to="/carrito" style={{ color: '#389e0d', fontWeight: 700 }}>Ver carrito</Link>
            </div>
          )}

          {/* WhatsApp */}
          <a href="https://wa.me/523319537644?text=Hola%2C%20me%20interesa%20el%20art%C3%ADculo%3A%20" target="_blank" rel="noreferrer"
            className="btn btn-outline"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', fontSize: 14, color: '#16a34a', borderColor: '#16a34a', marginBottom: 14 }}>
            💬 Preguntar por WhatsApp
          </a>

          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
            SKU: {item.sku} · Pago 100% seguro
          </div>
        </div>
      </div>

      {/* ── Recomendado ── */}
      {item.category && (
        <div style={{ marginTop: 56 }}>
          <div style={{ borderTop: '2px solid var(--navy-border)', paddingTop: 40 }}>
            <ItemSlideshow
              title="Recomendado para ti"
              queryKey={['related', item.category, String(item.id)]}
              params={{ category: item.category, limit: 10 }}
              viewAllLink={CATEGORY_LINK[item.category]}
            />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .item-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
