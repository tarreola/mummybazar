import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMyItems } from '../api/client'
import { useAuth } from '../store/auth'

const STATUS_LABEL: Record<string, string> = {
  received: 'Recibido', inspected: 'Inspeccionado', listed: 'Publicado',
  sold: 'Vendido', shipped: 'Enviado', delivered: 'Entregado',
  returned: 'Devuelto', archived: 'Donado',
}
const STATUS_TAG: Record<string, string> = {
  received: 'tag-gray', inspected: 'tag-blue', listed: 'tag-green',
  sold: 'tag-orange', shipped: 'tag-purple', delivered: 'tag-purple',
  returned: 'tag-red', archived: 'tag-gray',
}

export default function MyItems() {
  const { user } = useAuth()
  const [filterStatus, setFilterStatus] = useState('all')

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ['my-items'],
    queryFn: () => getMyItems().then(r => r.data),
  })

  const filtered = useMemo(() =>
    filterStatus === 'all' ? items : items.filter((i: any) => i.status === filterStatus),
    [items, filterStatus]
  )

  const totalNetEarned = useMemo(() =>
    items
      .filter((i: any) => ['delivered'].includes(i.status))
      .reduce((sum: number, i: any) => sum + Number(i.seller_payout || 0), 0),
    [items]
  )

  const totalPending = useMemo(() =>
    items
      .filter((i: any) => ['sold', 'shipped'].includes(i.status))
      .reduce((sum: number, i: any) => sum + Number(i.seller_payout || 0), 0),
    [items]
  )

  if (isLoading) return <div className="spinner" style={{ marginTop: 80 }} />

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      {/* Approval banner */}
      {user && !user.is_approved && (
        <div style={{
          background: '#fff7e6', border: '1.5px solid #ffd591',
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: '#d46b08', marginBottom: 2 }}>
              ⏳ Cuenta pendiente de aprobación
            </div>
            <div style={{ fontSize: 13, color: '#8c6b00' }}>
              Tu cuenta está siendo revisada por el equipo de MommyBazar.
              Una vez aprobada, tus artículos serán visibles en el catálogo.
            </div>
          </div>
          <a
            href="https://wa.me/525500000000?text=Hola%2C+quiero+que+aprueben+mi+cuenta+de+vendedora"
            className="btn btn-green"
            style={{ flexShrink: 0 }}
          >
            💬 Solicitar aprobación
          </a>
        </div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)', marginBottom: 4 }}>
        🏷️ Mis artículos en venta
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Aquí puedes seguir el estado de cada artículo que entregaste a MommyBazar.
      </p>

      {/* Resumen financiero */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Total artículos</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)' }}>{items.length}</div>
          </div>
          <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Ganado (70%)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#389e0d' }}>
              ${totalNetEarned.toLocaleString('es-MX')}
            </div>
          </div>
          <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Por cobrar</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#d46b08' }}>
              ${totalPending.toLocaleString('es-MX')}
            </div>
          </div>
        </div>
      )}

      {/* Filtro por estado */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['all', ...Object.keys(STATUS_LABEL)].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="btn btn-sm"
              style={{
                background: filterStatus === s ? 'var(--pink)' : '#fff',
                color: filterStatus === s ? '#fff' : 'var(--pink)',
                border: '1.5px solid var(--pink-border)',
              }}
            >
              {s === 'all' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
          No tienes artículos en este estado.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {filtered.map((item: any) => {
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
                  {item.seller_payout && (
                    <div style={{ fontSize: 11, color: '#389e0d', marginBottom: 4 }}>
                      Cobras: ${Number(item.seller_payout).toLocaleString('es-MX')}
                    </div>
                  )}
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
