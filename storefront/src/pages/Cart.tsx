import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'

export default function Cart() {
  const { items, remove, count } = useCart()

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--navy)', marginBottom: 6 }}>Carrito</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
        {count === 0 ? 'Tu carrito está vacío.' : `${count} artículo${count !== 1 ? 's' : ''} guardado${count !== 1 ? 's' : ''}`}
      </p>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 15 }}>Agrega artículos desde el catálogo</div>
          <Link to="/tienda/catalogo" className="btn btn-primary">Ir al catálogo</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 60, height: 75, background: 'var(--navy-light)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                {item.image
                  ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🧸</div>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{item.sku}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                  ${Number(item.price).toLocaleString('es-MX')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <Link to={`/articulo/${item.id}`} className="btn btn-primary btn-sm">Comprar</Link>
                <button onClick={() => remove(item.id)} className="btn btn-outline btn-sm" style={{ color: '#d42b2b', borderColor: '#d42b2b' }}>Quitar</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 12, padding: '16px 20px', background: 'var(--navy-light)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Total estimado</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>
                ${items.reduce((s, i) => s + i.price, 0).toLocaleString('es-MX')}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 200, textAlign: 'right' }}>
              Cada artículo se compra individualmente. Haz clic en "Comprar" en cada uno.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
