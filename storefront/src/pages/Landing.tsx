import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'

export default function Landing() {
  const { data: stats } = useQuery({
    queryKey: ['community-stats'],
    queryFn: () => axios.get('/api/v1/dashboard/community-stats').then(r => r.data),
    staleTime: 60_000,
  })

  return (
    <div>
      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #fff0f6 0%, #fce4ec 50%, #fff 100%)',
        padding: '60px 24px 72px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌸</div>
          <h1 style={{
            fontSize: 36, fontWeight: 900, color: 'var(--pink)',
            margin: '0 0 12px', lineHeight: 1.15,
          }}>
            La comunidad de mamás<br />que comparten con amor
          </h1>
          <p style={{
            fontSize: 17, color: 'var(--muted)', margin: '0 0 32px',
            lineHeight: 1.7, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto',
          }}>
            MommyBazar es el espacio donde mamás de Ciudad de México intercambian
            artículos de bebé y niños en excelentes condiciones — dando una segunda
            vida a lo que ya no usan y encontrando lo que sus hijos necesitan.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/catalogo" className="btn btn-primary" style={{ fontSize: 16, padding: '12px 32px' }}>
              Ver artículos disponibles
            </Link>
            <a href="https://wa.me/525500000000" className="btn btn-green" style={{ fontSize: 16, padding: '12px 32px' }}>
              💬 Contáctanos
            </a>
          </div>
        </div>
      </div>

      {/* ── Stats comunidad ── */}
      <div style={{
        background: 'var(--pink)',
        padding: '32px 24px',
      }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 24,
            textAlign: 'center',
          }}>
            {[
              { emoji: '👗', value: stats?.total_items ?? '…', label: 'Artículos disponibles' },
              { emoji: '💕', value: stats?.total_mamis ?? '…', label: 'Mamis en la comunidad' },
              { emoji: '🛍️', value: stats?.total_orders ?? '…', label: 'Compras realizadas' },
              { emoji: '🌍', value: 'CDMX', label: 'Ciudad de México' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>{s.emoji}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cómo funciona ── */}
      <div className="container" style={{ maxWidth: 900, padding: '60px 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, color: 'var(--pink)', marginBottom: 40 }}>
          ¿Cómo funciona?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {[
            {
              icon: '📦', title: 'Vendedoras entregan', color: '#fff0f6',
              desc: 'Las mamás nos traen sus artículos en buenas condiciones. Los inspeccionamos y publicamos en el catálogo.',
            },
            {
              icon: '🛒', title: 'Compradoras eligen', color: '#f0f9ff',
              desc: 'Busca lo que necesitas en el catálogo. Paga de forma segura y elige cómo recibir tu pedido.',
            },
            {
              icon: '🤝', title: 'Todos ganan', color: '#f6ffed',
              desc: 'La vendedora recibe el 70% del precio de venta. La compradora ahorra. El planeta agradece.',
            },
          ].map(c => (
            <div key={c.title} className="card" style={{ padding: 24, background: c.color, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{c.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pink)', marginBottom: 8 }}>{c.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA final ── */}
      <div style={{
        background: 'linear-gradient(135deg, #fff0f6 0%, #fff 100%)',
        padding: '48px 24px',
        textAlign: 'center',
        borderTop: '1px solid var(--pink-border)',
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--pink)', marginBottom: 8 }}>
          ¿Tienes artículos que ya no usas?
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 24 }}>
          Únete como vendedora y dale una nueva vida a lo que ya no necesitas.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/registro" className="btn btn-primary" style={{ fontSize: 15, padding: '10px 28px' }}>
            Registrarme como vendedora
          </Link>
          <Link to="/catalogo" className="btn btn-outline" style={{ fontSize: 15, padding: '10px 28px' }}>
            Ver el catálogo
          </Link>
        </div>
      </div>
    </div>
  )
}
