import { useSearchParams, Link } from 'react-router-dom'

export default function PaymentResult({ type }: { type: 'success' | 'failure' | 'pending' }) {
  const [params] = useSearchParams()
  const order = params.get('order')

  const config = {
    success: {
      icon: '🎉', color: '#389e0d',
      title: '¡Pago exitoso!',
      msg: 'Tu compra fue confirmada. Recibirás un mensaje de WhatsApp con los detalles.',
      tag: 'tag-green', tagLabel: 'Pago aprobado',
    },
    failure: {
      icon: '😔', color: '#cf1322',
      title: 'Pago no procesado',
      msg: 'No pudimos procesar tu pago. El artículo fue liberado. Puedes intentarlo de nuevo.',
      tag: 'tag-red', tagLabel: 'Pago fallido',
    },
    pending: {
      icon: '⏳', color: '#d46b08',
      title: 'Pago pendiente',
      msg: 'Tu pago está siendo procesado. Te notificaremos por WhatsApp cuando se confirme.',
      tag: 'tag-orange', tagLabel: 'En proceso',
    },
  }[type]

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 60, paddingBottom: 60, textAlign: 'center' }}>
      <div className="card" style={{ padding: 40 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{config.icon}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: config.color, marginBottom: 8 }}>{config.title}</h1>
        {order && (
          <div style={{ fontFamily: 'monospace', fontSize: 14, color: 'var(--pink)', marginBottom: 12 }}>
            Orden: {order}
          </div>
        )}
        <span className={`tag ${config.tag}`} style={{ marginBottom: 16, display: 'inline-block' }}>
          {config.tagLabel}
        </span>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
          {config.msg}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {type === 'success' ? (
            <Link to="/mis-compras" className="btn btn-primary">Ver mis compras</Link>
          ) : (
            <Link to="/" className="btn btn-primary">Volver al catálogo</Link>
          )}
          <a href="https://wa.me/525500000000" className="btn btn-green">
            💬 Contactar soporte
          </a>
        </div>
      </div>
    </div>
  )
}
