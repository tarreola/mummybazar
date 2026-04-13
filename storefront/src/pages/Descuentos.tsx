import { useQuery } from '@tanstack/react-query'
import { getItems } from '../api/client'
import ItemCard from '../components/ItemCard'

const GROUPS = [
  { label: '10% – 30% descuento', min: 10, max: 30, color: '#fff7e6', border: '#ffe58f' },
  { label: '30% – 50% descuento', min: 30, max: 50, color: '#fff0f6', border: '#ffa0c9' },
  { label: '50% – 75% descuento 🔥', min: 50, max: 75, color: '#fff1f0', border: '#ffa39e' },
]

export default function Descuentos() {
  const { data, isLoading } = useQuery({
    queryKey: ['sf-descuentos'],
    queryFn: () => getItems({ has_discount: true, limit: 100 }).then(r => r.data),
    staleTime: 60_000,
  })
  const all: any[] = data?.items || []

  const grouped = GROUPS.map(g => ({
    ...g,
    items: all.filter(item => {
      if (!item.original_price) return false
      const pct = Math.round((1 - item.selling_price / item.original_price) * 100)
      return pct >= g.min && pct < g.max
    }),
  }))

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div style={{ background: 'linear-gradient(135deg, var(--navy-light) 0%, #fff 70%)', border: '1px solid var(--navy-border)', borderRadius: 16, padding: '28px 24px', marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🏷️</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--navy)', margin: '0 0 6px' }}>Descuentos</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Artículos con precio reducido — ¡no te los pierdas!</p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>Cargando…</div>
      ) : all.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>Sin descuentos activos por el momento 🌸</div>
      ) : (
        grouped.map(g => g.items.length === 0 ? null : (
          <div key={g.label} style={{ marginBottom: 40 }}>
            <div style={{ background: g.color, border: `1.5px solid ${g.border}`, borderRadius: 12, padding: '14px 20px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>{g.label}</h2>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{g.items.length} artículo{g.items.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="grid-4">{g.items.map((item: any) => <ItemCard key={item.id} item={item} />)}</div>
          </div>
        ))
      )}
    </div>
  )
}
