import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'

const COND_BG: Record<string, string> = { like_new: '#f6ffed', good: '#e6f4ff', fair: '#fff7e6' }
const COND_COLOR: Record<string, string> = { like_new: '#389e0d', good: '#0958d9', fair: '#d46b08' }
const COND_LABEL: Record<string, string> = { like_new: 'Como nuevo', good: 'Bueno', fair: 'Regular' }

interface Props {
  item: any
  compact?: boolean
}

export default function ItemCard({ item, compact = false }: Props) {
  const { add, remove, has } = useCart()
  const inCart = has(item.id)
  const discount = item.original_price && item.original_price > item.selling_price
    ? Math.round((1 - item.selling_price / item.original_price) * 100)
    : null

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (inCart) remove(item.id)
    else add({ id: item.id, title: item.title, price: item.selling_price, image: item.images?.[0], sku: item.sku })
  }

  return (
    <Link to={`/articulo/${item.id}`} style={{ display: 'block', flexShrink: 0, width: compact ? 180 : undefined }}>
      <div className="card" style={{ overflow: 'hidden', transition: 'transform .15s, box-shadow .15s', height: '100%' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(26,58,107,.16)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)' }}
      >
        <div style={{ width: '100%', aspectRatio: '4/5', background: '#fafafa', overflow: 'hidden', position: 'relative' }}>
          {item.images?.[0]
            ? <img src={item.images[0]} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, background: 'var(--navy-light)' }}>🧸</div>
          }
          {discount && (
            <span style={{ position: 'absolute', top: 8, left: 8, background: '#d42b2b', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
              -{discount}%
            </span>
          )}
          {item.is_featured && !discount && (
            <span style={{ position: 'absolute', top: 8, left: 8, background: 'var(--navy)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
              ⭐ Destacado
            </span>
          )}
          <button onClick={handleCart} title={inCart ? 'Quitar del carrito' : 'Agregar al carrito'}
            style={{ position: 'absolute', top: 8, right: 8, background: inCart ? 'var(--navy)' : 'rgba(255,255,255,.9)', border: '1.5px solid var(--navy-border)', borderRadius: 8, padding: '4px 7px', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: inCart ? '#fff' : 'var(--navy)', transition: 'all .15s' }}>
            {inCart ? '✓' : '+'}
          </button>
        </div>
        <div style={{ padding: compact ? '8px 10px' : '10px 12px' }}>
          <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <div>
              <span style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: 'var(--navy)' }}>
                ${Number(item.selling_price).toLocaleString('es-MX')}
              </span>
              {discount && (
                <span style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'line-through', marginLeft: 5 }}>
                  ${Number(item.original_price).toLocaleString('es-MX')}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: COND_BG[item.condition] || '#f5f5f5', color: COND_COLOR[item.condition] || '#595959' }}>
              {COND_LABEL[item.condition] || item.condition}
            </span>
          </div>
          {item.size && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Talla: {item.size}</div>}
        </div>
      </div>
    </Link>
  )
}
