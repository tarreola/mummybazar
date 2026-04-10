import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getItems } from '../api/client'

const CATEGORIES: Record<string, string> = {
  all: 'Todo',
  clothing: 'Ropa', furniture: 'Muebles', lactancy: 'Lactancia',
  strollers: 'Carriolas', toys: 'Juguetes', accessories: 'Accesorios', other: 'Otro',
}
const CONDITIONS: Record<string, string> = {
  all: 'Cualquier condición', like_new: 'Como nuevo', good: 'Bueno', fair: 'Regular',
}
const STATUS_BG: Record<string, string> = {
  like_new: '#f6ffed', good: '#e6f4ff', fair: '#fff7e6',
}
const STATUS_COLOR: Record<string, string> = {
  like_new: '#389e0d', good: '#0958d9', fair: '#d46b08',
}

export default function Catalog() {
  const [category, setCategory] = useState('all')
  const [condition, setCondition] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sf-items', category, condition, search],
    queryFn: () => getItems({
      ...(category !== 'all' ? { category } : {}),
      ...(condition !== 'all' ? { condition } : {}),
      ...(search ? { search } : {}),
      limit: 40,
    }).then(r => r.data),
  })

  const items: any[] = data?.items || []
  const total: number = data?.total || 0

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #fff0f6 0%, #fff 60%)',
        border: '1px solid var(--pink-border)', borderRadius: 16,
        padding: '32px 24px', marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pink)' }}>
          Artículos de bebé y niños 🌸
        </div>
        <div style={{ color: 'var(--muted)', marginTop: 6, fontSize: 15 }}>
          Todo con mucho amor · Ciudad de México
        </div>
        {/* Search */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 440, margin: '16px auto 0', justifyContent: 'center' }}>
          <input
            type="text"
            placeholder="Buscar artículo, marca…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              border: '1.5px solid var(--pink-border)', fontSize: 14, outline: 'none',
            }}
          />
          <button className="btn btn-primary" onClick={() => setSearch(searchInput)}>
            Buscar
          </button>
          {search && (
            <button className="btn btn-outline" onClick={() => { setSearch(''); setSearchInput('') }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <button key={k}
            onClick={() => setCategory(k)}
            className="btn btn-sm"
            style={{
              background: category === k ? 'var(--pink)' : '#fff',
              color: category === k ? '#fff' : 'var(--pink)',
              border: '1.5px solid var(--pink-border)',
            }}>
            {v}
          </button>
        ))}
        <select
          value={condition}
          onChange={e => setCondition(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8,
            border: '1.5px solid var(--pink-border)', fontSize: 13,
            background: '#fff', cursor: 'pointer', outline: 'none',
          }}>
          {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Count */}
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        {isLoading ? 'Cargando…' : `${total} artículo${total !== 1 ? 's' : ''} disponible${total !== 1 ? 's' : ''}`}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          No encontramos artículos con esos filtros 🌸
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}>
          {items.map((item: any) => (
            <Link key={item.id} to={`/articulo/${item.id}`} style={{ display: 'block' }}>
              <div className="card" style={{ overflow: 'hidden', transition: 'transform .15s, box-shadow .15s' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(196,29,127,.14)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = ''
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow)'
                }}
              >
                {/* Photo */}
                <div style={{
                  width: '100%', aspectRatio: '4/5', background: '#fafafa',
                  overflow: 'hidden', position: 'relative',
                }}>
                  {item.images?.[0] ? (
                    <img src={item.images[0]} alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 36, background: 'var(--pink-light)',
                    }}>🧸</div>
                  )}
                  {item.is_featured && (
                    <span style={{
                      position: 'absolute', top: 8, left: 8,
                      background: 'var(--pink)', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    }}>⭐ Destacado</span>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--pink)' }}>
                      ${Number(item.selling_price).toLocaleString('es-MX')}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
                      background: STATUS_BG[item.condition] || '#f5f5f5',
                      color: STATUS_COLOR[item.condition] || '#595959',
                    }}>
                      {item.condition === 'like_new' ? 'Como nuevo' : item.condition === 'good' ? 'Bueno' : 'Regular'}
                    </span>
                  </div>
                  {item.size && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      Talla: {item.size}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
