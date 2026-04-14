import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'
import ItemSlideshow from '../components/ItemSlideshow'

const CATEGORIES = [
  { to: '/tienda/ropa',       label: 'Ropa',        emoji: '👗', color: '#fff0f6' },
  { to: '/tienda/muebles',    label: 'Muebles',     emoji: '🛋️', color: '#e6f4ff' },
  { to: '/tienda/lactancia',  label: 'Lactancia',   emoji: '🍼', color: '#f6ffed' },
  { to: '/tienda/carriolas',  label: 'Carriolas',   emoji: '🚼', color: '#fff7e6' },
  { to: '/tienda/juguetes',   label: 'Juguetes',    emoji: '🧸', color: '#f9f0ff' },
  { to: '/tienda/accesorios', label: 'Accesorios',  emoji: '🎀', color: '#fff0f6' },
  { to: '/tienda/descuentos', label: 'Descuentos',  emoji: '🏷️', color: '#fff1f0' },
  { to: '/tienda/catalogo',   label: 'Ver todo',    emoji: '🗂️', color: 'var(--navy-light)' },
]

const ETAPAS = [
  { label: '0 meses',     key: '0m',  size: '0m' },
  { label: '3 meses',     key: '3m',  size: '3m' },
  { label: '6 meses',     key: '6m',  size: '6m' },
  { label: '9 meses',     key: '9m',  size: '9m' },
  { label: '12 meses',    key: '12m', size: '12m' },
  { label: '18 meses',    key: '18m', size: '18m' },
  { label: '2 a 5+ años', key: '2a',  size: '2a+' },
]

const PRECIOS = [
  { label: 'Menos de $500',   key: 'p1', params: { max_price: 500 } },
  { label: '$500 – $1,000',   key: 'p2', params: { min_price: 500, max_price: 1000 } },
  { label: 'Más de $1,000',   key: 'p3', params: { min_price: 1000 } },
]

export default function Landing() {
  const [activeEtapa, setActiveEtapa] = useState(ETAPAS[0].key)
  const activeEtapaData = ETAPAS.find(e => e.key === activeEtapa)!

  const { data: stats } = useQuery({
    queryKey: ['community-stats'],
    queryFn: () => axios.get('/api/v1/dashboard/community-stats').then(r => r.data),
    staleTime: 60_000,
  })

  return (
    <div>
      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-light) 0%, #fff 60%)', padding: '56px 24px 64px', textAlign: 'center', borderBottom: '1px solid var(--navy-border)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <img src="/logo.png" alt="El Ropero de Mar" style={{ height: 90, marginBottom: 16 }} />
          <h1 style={{ fontSize: 34, fontWeight: 900, color: 'var(--navy)', margin: '0 0 12px', lineHeight: 1.2 }}>
            La tienda de segunda mano<br />de mamás para mamás
          </h1>
          <p style={{ fontSize: 16, color: 'var(--muted)', margin: '0 0 32px', lineHeight: 1.7, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Ropa, muebles, juguetes y accesorios de bebé en excelentes condiciones — a precios increíbles.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/tienda/catalogo" className="btn btn-primary" style={{ fontSize: 15, padding: '12px 28px' }}>Ver artículos</Link>
            <Link to="/vende" className="btn btn-outline" style={{ fontSize: 15, padding: '12px 28px' }}>Quiero vender</Link>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ background: 'var(--navy)', padding: '24px' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, textAlign: 'center' }}>
            {[
              { value: stats?.total_items ?? '…', label: 'Artículos disponibles' },
              { value: stats?.total_mamis ?? '…', label: 'Mamis en la comunidad' },
              { value: stats?.total_orders ?? '…', label: 'Compras realizadas' },
              { value: 'CDMX', label: 'Ciudad de México' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#93b4e0', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Categorías ── */}
      <div className="container" style={{ padding: '40px 16px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', marginBottom: 20, textAlign: 'center' }}>Explora por categoría</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
          {CATEGORIES.map(c => (
            <Link key={c.to} to={c.to}>
              <div className="card" style={{ padding: '16px 12px', textAlign: 'center', background: c.color, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(26,58,107,.14)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{c.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{c.label}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recién Subido ── */}
      <div className="container" style={{ padding: '8px 16px 16px' }}>
        <ItemSlideshow
          title="✨ Recién subido"
          queryKey={['sf-recent']}
          params={{ sort: 'newest', limit: 10 }}
          viewAllLink="/tienda/catalogo"
        />
      </div>

      {/* ── Por etapa ── */}
      <div style={{ background: 'var(--navy-light)', padding: '40px 0', borderTop: '1px solid var(--navy-border)', borderBottom: '1px solid var(--navy-border)' }}>
        <div className="container" style={{ padding: '0 16px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', marginBottom: 16, textAlign: 'center' }}>Por etapa</h2>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
            {ETAPAS.map(e => (
              <button key={e.key} onClick={() => setActiveEtapa(e.key)} className="btn btn-sm"
                style={{ background: activeEtapa === e.key ? 'var(--navy)' : '#fff', color: activeEtapa === e.key ? '#fff' : 'var(--navy)', border: '1.5px solid var(--navy-border)' }}>
                {e.label}
              </button>
            ))}
          </div>
          <ItemSlideshow
            key={activeEtapa}
            title={`Talla ${activeEtapaData.label}`}
            queryKey={['sf-etapa', activeEtapa]}
            params={{ size: activeEtapaData.size, limit: 10 }}
            viewAllLink={`/tienda/ropa`}
          />
        </div>
      </div>

      {/* ── Por precio ── */}
      <div className="container" style={{ padding: '40px 16px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', marginBottom: 24, textAlign: 'center' }}>Por precio</h2>
        {PRECIOS.map(p => (
          <ItemSlideshow
            key={p.key}
            title={p.label}
            queryKey={['sf-precio', p.key]}
            params={p.params}
            viewAllLink="/tienda/catalogo"
          />
        ))}
      </div>

      {/* ── CTA vendedora ── */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy) 0%, #2e5fa3 100%)', padding: '48px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 10 }}>¿Tienes artículos que ya no usas?</h2>
        <p style={{ color: '#93b4e0', fontSize: 15, marginBottom: 24 }}>Únete como vendedora y recibe el 70% del precio de venta.</p>
        <Link to="/vende" className="btn btn-green" style={{ fontSize: 15, padding: '12px 28px' }}>Quiero ser vendedora</Link>
      </div>
    </div>
  )
}
