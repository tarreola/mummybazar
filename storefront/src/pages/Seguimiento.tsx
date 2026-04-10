import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pago pendiente',
  paid: 'Compra realizada',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Confirmado',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
}

const STATUS_COLOR: Record<string, string> = {
  pending_payment: '#faad14',
  paid: '#1677ff',
  preparing: '#13c2c2',
  shipped: '#722ed1',
  delivered: '#52c41a',
  closed: '#8c8c8c',
  cancelled: '#f5222d',
  refunded: '#8c8c8c',
}

// Main progress flow (closed is terminal, shown separately)
const FLOW = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered']

const FLOW_LABEL: Record<string, string> = {
  pending_payment: 'Pago pendiente',
  paid: 'Compra realizada',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Confirmado',
}

const FLOW_ICON: Record<string, string> = {
  pending_payment: '💳',
  paid: '✅',
  preparing: '📦',
  shipped: '🚚',
  delivered: '🎀',
}

const SHIPPING_LABEL: Record<string, string> = {
  pickup: 'Recoger en punto',
  delivery_cdmx: 'Entrega CDMX',
  parcel: 'Paquetería',
}

export default function Seguimiento() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = query.trim().toUpperCase()
    if (!num) return
    setError('')
    setOrder(null)
    setLoading(true)
    try {
      const res = await axios.get(`/api/v1/storefront/order-tracking/${num}`)
      setOrder(res.data)
    } catch (err: any) {
      if (err.response?.status === 404)
        setError('Pedido no encontrado. Revisa el número e intenta de nuevo.')
      else
        setError('Error al buscar el pedido. Intenta más tarde.')
    }
    setLoading(false)
  }

  // For closed orders, treat as "delivered" progress (full bar)
  const effectiveStatus = order?.status === 'closed' ? 'delivered' : order?.status
  const currentIdx = order ? FLOW.indexOf(effectiveStatus) : -1
  const isClosed = order && ['cancelled', 'refunded'].includes(order.status)

  return (
    <div className="container" style={{ maxWidth: 620, paddingTop: 40, paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--pink)', margin: '0 0 6px' }}>
          Rastrear mi pedido
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Ingresa el número de orden que recibiste por WhatsApp
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={buscar} style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ORD-2024-00001"
          style={{
            flex: 1, padding: '13px 18px', borderRadius: 12,
            border: '2px solid var(--pink-border)', fontSize: 16,
            fontFamily: 'monospace', letterSpacing: 1,
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--pink)')}
          onBlur={e => (e.target.style.borderColor = 'var(--pink-border)')}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '13px 28px', borderRadius: 12, whiteSpace: 'nowrap', fontSize: 15 }}
          disabled={loading}
        >
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fff1f0', border: '1px solid #ffccc7',
          borderRadius: 12, padding: '14px 18px',
          color: '#cf1322', fontSize: 14, marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {/* Result card */}
      {order && (
        <div className="card" style={{ padding: 28 }}>

          {/* Order header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                {order.order_number}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--pink)', lineHeight: 1.3 }}>
                {order.item?.title || '—'}
              </div>
              {order.item?.sku && (
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {order.item.sku}
                </div>
              )}
            </div>
            <div style={{
              padding: '6px 16px', borderRadius: 20,
              background: isClosed ? '#fff1f0' : 'var(--pink-light)',
              border: `2px solid ${STATUS_COLOR[order.status]}`,
              color: STATUS_COLOR[order.status],
              fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
            }}>
              {STATUS_LABEL[order.status] || order.status}
            </div>
          </div>

          {/* Closed banner */}
          {order.status === 'closed' && (
            <div style={{
              background: '#f6ffed', border: '1px solid #b7eb8f',
              borderRadius: 10, padding: '10px 16px', marginBottom: 16,
              fontSize: 13, color: '#389e0d', fontWeight: 600,
            }}>
              🔒 Este pedido está cerrado. ¡Gracias por tu compra en MommyBazar! 🌸
            </div>
          )}

          {/* Item image */}
          {order.item?.image && (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <img
                src={order.item.image}
                alt={order.item.title}
                style={{ maxWidth: 140, maxHeight: 140, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--pink-border)' }}
              />
            </div>
          )}

          {/* Timeline */}
          {!isClosed ? (
            <div style={{ marginBottom: 28 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>
                {/* Background track */}
                <div style={{
                  position: 'absolute', top: 18, left: '10%', right: '10%', height: 3,
                  background: '#f0d0e0', borderRadius: 2, zIndex: 0,
                }} />
                {/* Progress fill */}
                <div style={{
                  position: 'absolute', top: 18, left: '10%', height: 3,
                  width: currentIdx >= 0 ? `${(currentIdx / (FLOW.length - 1)) * 80}%` : '0%',
                  background: 'var(--pink)', borderRadius: 2, zIndex: 1,
                  transition: 'width 0.5s ease',
                }} />

                {FLOW.map((step, i) => {
                  const done = i <= currentIdx
                  const active = i === currentIdx
                  return (
                    <div key={step} style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', position: 'relative', zIndex: 2,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: done ? 'var(--pink)' : '#f8e0ef',
                        border: active ? '3px solid var(--pink)' : `2px solid ${done ? 'var(--pink)' : '#f0d0e0'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: done ? 14 : 12,
                        boxShadow: active ? '0 0 0 5px rgba(196,29,127,0.12)' : 'none',
                        transition: 'all 0.3s',
                      }}>
                        {done ? (active ? FLOW_ICON[step] : '✓') : <span style={{ color: '#ccc', fontWeight: 700, fontSize: 11 }}>{i + 1}</span>}
                      </div>
                      <div style={{
                        fontSize: 10, textAlign: 'center', marginTop: 6, lineHeight: 1.3,
                        color: done ? 'var(--pink)' : 'var(--muted)',
                        fontWeight: active ? 700 : 400,
                        maxWidth: 60,
                      }}>
                        {FLOW_LABEL[step]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#fff1f0', border: '1px solid #ffccc7',
              borderRadius: 12, padding: '14px 18px', marginBottom: 24,
              color: '#cf1322', fontWeight: 600, fontSize: 14,
            }}>
              ❌ {STATUS_LABEL[order.status]}
            </div>
          )}

          {/* Details grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px',
            borderTop: '1px solid var(--pink-border)', paddingTop: 20,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Total pagado</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--pink)' }}>
                ${Number(order.amount).toLocaleString('es-MX')} MXN
              </div>
            </div>

            {order.shipping_method && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Método de envío</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {SHIPPING_LABEL[order.shipping_method] || order.shipping_method}
                </div>
              </div>
            )}

            {order.tracking_number && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Número de rastreo</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#262626' }}>
                  {order.tracking_number}
                </div>
                {order.shipping_carrier && (
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{order.shipping_carrier}</div>
                )}
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Fecha de compra</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {new Date(order.created_at).toLocaleDateString('es-MX', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* Help */}
          <div style={{
            marginTop: 24, padding: '14px 16px',
            background: 'var(--pink-light)', borderRadius: 12,
            fontSize: 13, color: 'var(--muted)', lineHeight: 1.5,
          }}>
            ¿Tienes dudas sobre tu pedido? Escríbenos por WhatsApp y con gusto te ayudamos. 🌸
          </div>
        </div>
      )}

      {/* Back to catalog */}
      <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--muted)' }}>
        <Link to="/catalogo" style={{ color: 'var(--pink)' }}>← Volver al catálogo</Link>
      </div>
    </div>
  )
}
