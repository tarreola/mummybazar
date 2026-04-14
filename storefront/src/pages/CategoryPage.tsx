import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getItems } from '../api/client'
import ItemCard from '../components/ItemCard'

const COND_OPTIONS = [
  { k: 'all',      label: 'Cualquier condición' },
  { k: 'like_new', label: 'Como nuevo' },
  { k: 'good',     label: 'Bueno' },
  { k: 'fair',     label: 'Regular' },
]
const GENDER_OPTIONS = [
  { k: 'all',    label: 'Para todos' },
  { k: 'girl',   label: 'Niña' },
  { k: 'boy',    label: 'Niño' },
  { k: 'unisex', label: 'Unisex' },
]
const SIZE_OPTIONS = [
  { k: 'all', label: 'Todas' },
  { k: '0m',  label: '0 Meses' },
  { k: '3m',  label: '3 Meses' },
  { k: '6m',  label: '6 Meses' },
  { k: '9m',  label: '9 Meses' },
  { k: '12m', label: '12 Meses' },
  { k: '18m', label: '18 Meses' },
  { k: '2a+', label: '2 a 5+ Años' },
]

const CATEGORY_META: Record<string, { label: string; emoji: string; showGender?: boolean; showSize?: boolean; desc: string }> = {
  clothing:    { label: 'Ropa',              emoji: '👗', showGender: true, showSize: true,  desc: 'Ropa de bebé y niños en excelente estado' },
  furniture:   { label: 'Muebles',           emoji: '🛋️', desc: 'Muebles y mobiliario infantil' },
  lactancy:    { label: 'Lactancia',         emoji: '🍼', desc: 'Artículos de lactancia y alimentación' },
  strollers:   { label: 'Carriolas',         emoji: '🚼', desc: 'Carriolas, portabebés y sillas de paseo' },
  toys:        { label: 'Juguetes',          emoji: '🧸', desc: 'Juguetes y entretenimiento' },
  accessories: { label: 'Accesorios y Otros',emoji: '🎀', desc: 'Accesorios, bolsas, mochilas y más' },
}

interface Props { category: string }

export default function CategoryPage({ category }: Props) {
  const meta = CATEGORY_META[category] || { label: category, emoji: '🏷️', desc: '' }
  const [condition, setCondition] = useState('all')
  const [gender, setGender] = useState('all')
  const [size, setSize] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['sf-cat', category, condition, gender, size],
    queryFn: () => getItems({
      category,
      ...(condition !== 'all' ? { condition } : {}),
      ...(gender !== 'all' ? { gender } : {}),
      ...(size !== 'all' ? { size } : {}),
      limit: 60,
    }).then(r => r.data),
  })
  const items: any[] = data?.items || []
  const total: number = data?.total || 0

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} className="btn btn-sm"
      style={{ background: active ? 'var(--navy)' : '#fff', color: active ? '#fff' : 'var(--navy)', border: '1.5px solid var(--navy-border)' }}>
      {label}
    </button>
  )

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-light) 0%, #fff 70%)', border: '1px solid var(--navy-border)', borderRadius: 16, padding: '28px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>{meta.emoji}</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--navy)', margin: '0 0 6px' }}>{meta.label}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{meta.desc}</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginRight: 4 }}>Condición:</span>
        {COND_OPTIONS.map(o => chip(o.label, condition === o.k, () => setCondition(o.k)))}
        {meta.showGender && (
          <>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginLeft: 8, marginRight: 4 }}>Para:</span>
            {GENDER_OPTIONS.map(o => chip(o.label, gender === o.k, () => setGender(o.k)))}
          </>
        )}
        {meta.showSize && (
          <>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginLeft: 8, marginRight: 4 }}>Talla:</span>
            {SIZE_OPTIONS.map(o => chip(o.label, size === o.k, () => setSize(o.k)))}
          </>
        )}
      </div>

      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        {isLoading ? 'Cargando…' : `${total} artículo${total !== 1 ? 's' : ''} disponible${total !== 1 ? 's' : ''}`}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>Cargando…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>Sin artículos con esos filtros 🌸</div>
      ) : (
        <div className="grid-4">{items.map((item: any) => <ItemCard key={item.id} item={item} />)}</div>
      )}
    </div>
  )
}
