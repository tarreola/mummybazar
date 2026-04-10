import { useQuery } from '@tanstack/react-query'
import { getMyItems } from '../api/client'

const STATUS_LABEL: Record<string, string> = {
  received: 'Recibido', inspected: 'Inspeccionado', listed: 'Publicado',
  sold: 'Vendido', shipped: 'Enviado', delivered: 'Entregado',
  returned: 'Devuelto', archived: 'Archivado',
}
const STATUS_TAG: Record<string, string> = {
  received: 'tag-gray', inspected: 'tag-blue', listed: 'tag-green',
  sold: 'tag-orange', shipped: 'tag-purple', delivered: 'tag-purple',
  returned: 'tag-red', archived: 'tag-gray',
}

export default function MyItems() {
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ['my-items'],
    queryFn: () => getMyItems().then(r => r.data),
  })

  if (isLoading) return <div className="spinner" style={{ marginTop: 80 }} />

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)', marginBottom: 8 }}>
        🏷️ Mis artículos en venta
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Aquí puedes seguir el estado de cada artículo que entregaste a MommyBazar.
      </p>

      {items.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🌸</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 8 }}>
            Aún no tienes artículos registrados
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Contáctanos por WhatsApp para coordinar la entrega de tus artículos.
          </p>
          <a href="https://wa.me/525500000000" className="btn btn-green" style={{ marginTop: 20, display: 'inline-flex' }}>
            💬 Contactar MommyBazar
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {items.map((item: any) => {
            const images = item.images || []
            return (
              <div key={item.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ aspectRatio: '4/5', background: 'var(--pink-light)', overflow: 'hidden' }}>
                  {images[0] ? (
                    <img src={images[0]} alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🧸</div>
                  )}
                </div>
                <div style={{ padding: '12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{item.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--pink)' }}>
                      ${Number(item.selling_price).toLocaleString('es-MX')}
                    </span>
                    <span className={`tag ${STATUS_TAG[item.status] || 'tag-gray'}`}>
                      {STATUS_LABEL[item.status] || item.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{item.sku}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
