import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMyOrders } from '../api/client'
import dayjs from 'dayjs'

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pago pendiente', paid: 'Pagado', preparing: 'Preparando',
  shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado',
}
const STATUS_TAG: Record<string, string> = {
  pending_payment: 'tag-orange', paid: 'tag-blue', preparing: 'tag-blue',
  shipped: 'tag-purple', delivered: 'tag-green', cancelled: 'tag-red', refunded: 'tag-gray',
}

const STEPS = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered']

function OrderCard({ order }: { order: any }) {
  const currentStep = STEPS.indexOf(order.status)
  const isClosed = order.status === 'cancelled' || order.status === 'refunded'

  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--pink)', fontWeight: 700 }}>
            {order.order_number}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {dayjs(order.created_at).format('DD/MM/YYYY HH:mm')}
          </div>
        </div>
        <div>
          <span className={`tag ${STATUS_TAG[order.status] || 'tag-gray'}`}>
            {STATUS_LABEL[order.status] || order.status}
          </span>
        </div>
      </div>

      {/* Item info */}
      {order.item && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          {order.item.image && (
            <img src={order.item.image} alt={order.item.title}
              style={{ width: 60, height: 75, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--pink-border)' }} />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{order.item.title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{order.item.sku}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pink)', marginTop: 2 }}>
              ${Number(order.amount).toLocaleString('es-MX')} MXN
            </div>
          </div>
        </div>
      )}

      {/* Progress bar (only for non-closed orders) */}
      {!isClosed && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', margin: '0 auto 4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                  background: i <= currentStep ? 'var(--pink)' : 'var(--pink-light)',
                  color: i <= currentStep ? '#fff' : 'var(--pink)',
                  fontWeight: 700,
                }}>
                  {i <= currentStep ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 9, color: i <= currentStep ? 'var(--pink)' : 'var(--muted)', fontWeight: i === currentStep ? 700 : 400 }}>
                  {s === 'pending_payment' ? 'Pago' : s === 'paid' ? 'Pagado' : s === 'preparing' ? 'Preparando' : s === 'shipped' ? 'Enviado' : 'Entregado'}
                </div>
              </div>
            ))}
          </div>
          {/* Progress line */}
          <div style={{ position: 'relative', height: 4, background: 'var(--pink-light)', borderRadius: 2, margin: '0 12px' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2,
              background: 'var(--pink)',
              width: `${Math.max(0, currentStep) / (STEPS.length - 1) * 100}%`,
              transition: 'width .4s',
            }} />
          </div>
        </div>
      )}

      {/* Tracking */}
      {order.tracking_number && (
        <div style={{ background: 'var(--pink-light)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          🚚 <strong>Número de rastreo:</strong> <code style={{ color: 'var(--pink)' }}>{order.tracking_number}</code>
          {order.shipping_carrier && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({order.shipping_carrier})</span>}
        </div>
      )}
    </div>
  )
}

export default function MyOrders() {
  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ['my-orders'],
    queryFn: () => getMyOrders().then(r => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading) return <div className="spinner" style={{ marginTop: 80 }} />

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 32, paddingBottom: 60 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)', marginBottom: 24 }}>
        🛍️ Mis compras
      </h1>

      {orders.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🌸</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 8 }}>
            Aún no has hecho ninguna compra
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
            Explora nuestro catálogo y encuentra algo especial.
          </p>
          <Link to="/" className="btn btn-primary">Ver catálogo</Link>
        </div>
      ) : (
        orders.map((o: any) => <OrderCard key={o.id} order={o} />)
      )}
    </div>
  )
}
