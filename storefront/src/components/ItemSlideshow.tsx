import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getItems } from '../api/client'
import ItemCard from './ItemCard'

interface Props {
  title: string
  queryKey: string[]
  params: Record<string, any>
  viewAllLink?: string
}

export default function ItemSlideshow({ title, queryKey, params, viewAllLink }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getItems({ ...params, limit: 10 }).then(r => r.data),
    staleTime: 60_000,
  })
  const items: any[] = data?.items || []

  const scroll = (dir: number) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>{title}</h3>
        {viewAllLink && (
          <Link to={viewAllLink} className="btn btn-outline btn-sm">Ver todo →</Link>
        )}
      </div>

      {isLoading ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
          Próximamente artículos en esta sección 🌸
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <button onClick={() => scroll(-1)} style={{ position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: '#fff', border: '1.5px solid var(--navy-border)', borderRadius: 99, width: 28, height: 28, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>‹</button>
          <div ref={ref} style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollBehavior: 'smooth', paddingBottom: 8, scrollbarWidth: 'none' } as any}>
            {items.map((item: any) => (
              <ItemCard key={item.id} item={item} compact />
            ))}
          </div>
          <button onClick={() => scroll(1)} style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: '#fff', border: '1.5px solid var(--navy-border)', borderRadius: 99, width: 28, height: 28, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>›</button>
        </div>
      )}
    </div>
  )
}
