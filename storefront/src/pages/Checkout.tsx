import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useCart } from '../store/cart'
import { checkoutGuest } from '../api/client'

export default function Checkout() {
  const { items, clear } = useCart()
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' })
  const [error, setError] = useState('')

  const total = items.reduce((s, i) => s + i.price, 0)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => checkoutGuest({
      item_ids: items.map(i => i.id),
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || undefined,
    }),
    onSuccess: (res) => {
      clear()
      window.location.href = res.data.checkout_url
    },
    onError: (e: any) => {
      const detail = e.response?.data?.detail
      const status = e.response?.status
      if (status === 409) {
        setError('Uno o más artículos ya no están disponibles. Vuelve al carrito para actualizar.')
      } else {
        setError(detail || 'Error al procesar el pago. Intenta de nuevo.')
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.full_name.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.phone.trim()) { setError('El teléfono es obligatorio'); return }
    mutation.mutate()
  }

  if (items.length === 0) {
    return (
      <div className="container" style={{ paddingTop: 64, textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
        <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Tu carrito está vacío.</p>
        <Link to="/tienda/catalogo" className="btn btn-primary">Ir al catálogo</Link>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 64, maxWidth: 680 }}>
      <Link to="/carrito" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
        ← Volver al carrito
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

        {/* ── Form ── */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', marginBottom: 6 }}>Datos de contacto</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
            Te enviaremos la confirmación de tu pedido por WhatsApp.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nombre completo *</label>
              <input
                required
                value={form.full_name}
                onChange={set('full_name')}
                placeholder="María González"
                autoComplete="name"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>WhatsApp *</label>
              <input
                required
                value={form.phone}
                onChange={set('phone')}
                placeholder="+525512345678"
                type="tel"
                autoComplete="tel"
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Incluye el código de país. Ej: +52 55 1234 5678
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Email <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</span></label>
              <input
                value={form.email}
                onChange={set('email')}
                placeholder="tu@email.com"
                type="email"
                autoComplete="email"
              />
            </div>

            {error && (
              <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#cf1322' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '15px', fontSize: 16, fontWeight: 800, borderRadius: 12, marginTop: 4 }}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? 'Generando link de pago…'
                : `💳 Pagar $${total.toLocaleString('es-MX', { minimumFractionDigits: 0 })} MXN`}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pago 100% seguro con MercadoPago</span>
            </div>
          </form>
        </div>

        {/* ── Order summary ── */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>
            Resumen ({items.length} artículo{items.length !== 1 ? 's' : ''})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--navy-light)', borderRadius: 10, border: '1px solid var(--navy-border)' }}>
                <div style={{ width: 44, height: 55, background: '#e8eff8', borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
                  {item.image
                    ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.title} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧸</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.sku}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', flexShrink: 0 }}>
                  ${Number(item.price).toLocaleString('es-MX')}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{ borderTop: '2px solid var(--navy-border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>Total</span>
            <span style={{ fontWeight: 900, color: 'var(--navy)', fontSize: 22 }}>
              ${total.toLocaleString('es-MX', { minimumFractionDigits: 0 })} MXN
            </span>
          </div>

          {/* WhatsApp help */}
          <a
            href="https://wa.me/523319537644"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '10px 14px', background: '#f6fff8', border: '1px solid #b7eb8f', borderRadius: 10, textDecoration: 'none', fontSize: 13, color: '#389e0d', fontWeight: 600 }}
          >
            💬 ¿Tienes dudas? Escríbenos por WhatsApp
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .checkout-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
