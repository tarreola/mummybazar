import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { registerSeller, login as sfLogin, getMyItems, submitItem, uploadMyItemImage } from '../api/client'

// Status display config
function itemBadge(status: string) {
  if (['received', 'inspected'].includes(status)) {
    return { label: '⏳ Pendiente de aprobación', bg: '#fff7e6', color: '#d46b08', border: '#ffe58f' }
  }
  if (status === 'listed') {
    return { label: '✅ Publicado', bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' }
  }
  if (['sold', 'shipped', 'delivered'].includes(status)) {
    return { label: '💰 Vendido', bg: '#f9f0ff', color: '#722ed1', border: '#d3adf7' }
  }
  if (status === 'returned') return { label: 'Devuelto', bg: '#fff1f0', color: '#cf1322', border: '#ffa39e' }
  if (status === 'archived') return { label: 'Archivado', bg: '#f5f5f5', color: '#8c8c8c', border: '#d9d9d9' }
  return { label: status, bg: '#f5f5f5', color: '#595959', border: '#d9d9d9' }
}

const CATEGORIES = [
  { value: 'clothing',    label: 'Ropa' },
  { value: 'furniture',   label: 'Muebles' },
  { value: 'lactancy',    label: 'Lactancia' },
  { value: 'strollers',   label: 'Carriolas' },
  { value: 'toys',        label: 'Juguetes' },
  { value: 'accessories', label: 'Accesorios y Otros' },
  { value: 'other',       label: 'Otro' },
]
const CONDITIONS = [
  { value: 'like_new', label: 'Como nuevo' },
  { value: 'good',     label: 'Buen estado' },
  { value: 'fair',     label: 'Estado regular' },
]

const EMPTY_ITEM = { title: '', category: 'clothing', condition: 'like_new', brand: '', size: '', color: '', description: '', selling_price: '' }

export default function Vende() {
  const { isAuthenticated, user, login } = useAuth()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', neighborhood: '', bank_name: '', clabe: '' })

  // Item filter: 'all' | 'sold'
  const [filter, setFilter] = useState<'all' | 'sold'>('all')

  // Add item modal
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [itemError, setItemError] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // My items
  const { data: myItems = [] } = useQuery({
    queryKey: ['my-items'],
    queryFn: () => getMyItems().then(r => r.data),
    enabled: isAuthenticated && user?.role === 'seller',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  const setItem = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setItemForm(p => ({ ...p, [k]: e.target.value }))

  const registerMutation = useMutation({
    mutationFn: () => registerSeller(form),
    onSuccess: (res) => {
      login(res.data.access_token, { name: res.data.name, role: 'seller', is_approved: res.data.is_approved })
      setSuccess('¡Registro exitoso! Bienvenida. Tu cuenta está en revisión.')
    },
    onError: (e: any) => setError(e.response?.data?.detail || 'Error al registrarse'),
  })

  const loginMutation = useMutation({
    mutationFn: () => sfLogin({ phone: form.phone, password: form.password, role: 'seller' }),
    onSuccess: (res) => {
      login(res.data.access_token, { name: res.data.name, role: 'seller', is_approved: res.data.is_approved })
    },
    onError: (e: any) => setError(e.response?.data?.detail || 'Número o contraseña incorrectos'),
  })

  const addItemMutation = useMutation({
    mutationFn: async () => {
      // 1. Create item (always required)
      const res = await submitItem({
        ...itemForm,
        selling_price: itemForm.selling_price ? Number(itemForm.selling_price) : undefined,
      })
      const itemId = res.data.id
      // 2. Upload photos (best-effort — don't fail submission if photos fail)
      if (photos.length > 0) {
        setUploading(true)
        for (const file of photos) {
          try {
            await uploadMyItemImage(itemId, file)
          } catch {
            // Photo upload failed silently — item is already created
          }
        }
        setUploading(false)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-items'] })
      setShowAddItem(false)
      setItemForm(EMPTY_ITEM)
      setPhotos([])
      setPhotoPreviews([])
      setItemError('')
    },
    onError: (e: any) => {
      setUploading(false)
      const detail = e.response?.data?.detail
      const status = e.response?.status
      const axiosMsg = e.message || ''
      setItemError(detail || (status ? `Error ${status}` : `Error: ${axiosMsg || 'sin respuesta del servidor'}`))
    },
  })

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remaining = 6 - photos.length
    const toAdd = files.slice(0, remaining)
    setPhotos(p => [...p, ...toAdd])
    toAdd.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => setPhotoPreviews(p => [...p, ev.target?.result as string])
      reader.readAsDataURL(f)
    })
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const removePhoto = (idx: number) => {
    setPhotos(p => p.filter((_, i) => i !== idx))
    setPhotoPreviews(p => p.filter((_, i) => i !== idx))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (mode === 'register') registerMutation.mutate()
    else loginMutation.mutate()
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault(); setItemError('')
    if (!itemForm.title) { setItemError('El título es obligatorio'); return }
    addItemMutation.mutate()
  }

  // ── Logged in as seller ──────────────────────────────────────────────────────
  if (isAuthenticated && user?.role === 'seller') {
    const soldItems = myItems.filter((i: any) => ['sold', 'shipped', 'delivered'].includes(i.status))
    const totalVendido = soldItems.reduce((sum: number, i: any) => sum + (Number(i.seller_payout) || Number(i.selling_price) * 0.7), 0)
    const listed = myItems.filter((i: any) => i.status === 'listed').length
    const displayed = filter === 'sold' ? soldItems : myItems

    return (
      <div className="container" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 820 }}>
        {/* Profile header */}
        <div style={{ background: 'linear-gradient(135deg, var(--navy-light) 0%, #fff 70%)', border: '1px solid var(--navy-border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 28 }}>🌸</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', margin: '8px 0 4px' }}>
            Mi Cuenta — {user.name.split(' ')[0]}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{user.name}</div>
          {!user.is_approved && (
            <div style={{ background: '#fff7e6', border: '1px solid #ffe58f', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#d46b08', marginTop: 12 }}>
              ⏳ Tu cuenta está en revisión. El equipo de El Ropero de Mar te avisará cuando sea aprobada.
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total artículos', value: myItems.length, color: 'var(--navy)' },
            { label: 'Publicados', value: listed, color: '#52c41a' },
            { label: 'Vendidos', value: soldItems.length, color: '#722ed1' },
            {
              label: 'Total Vendido (70%)',
              value: `$${totalVendido.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              color: '#cf1322',
            },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: s.label.startsWith('Total Vendido') ? 18 : 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* My items header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>Mis artículos</h2>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              {[{ key: 'all', label: 'Todos' }, { key: 'sold', label: 'Vendidos' }].map(t => (
                <button key={t.key} onClick={() => setFilter(t.key as any)}
                  style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, border: '1.5px solid var(--navy-border)', cursor: 'pointer', background: filter === t.key ? 'var(--navy)' : '#fff', color: filter === t.key ? '#fff' : 'var(--muted)' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add item button — only when approved */}
          {user.is_approved && (
            <button onClick={() => setShowAddItem(true)} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
              + Agregar artículo
            </button>
          )}
        </div>

        {/* Items list */}
        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            {filter === 'sold' ? 'Aún no tienes artículos vendidos.' : 'Aún no tienes artículos registrados.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map((item: any) => {
              const badge = itemBadge(item.status)
              return (
                <div key={item.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 50, height: 62, background: 'var(--navy-light)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    {item.images?.[0]
                      ? <img src={item.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.title} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🧸</div>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{item.sku}</div>
                    {/* Status badge */}
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
                      ${Number(item.selling_price).toLocaleString('es-MX')}
                    </div>
                    {['sold', 'shipped', 'delivered'].includes(item.status) && item.seller_payout && (
                      <div style={{ fontSize: 11, color: '#389e0d', fontWeight: 600 }}>
                        Tu ganancia: ${Number(item.seller_payout).toLocaleString('es-MX')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add item modal */}
        {showAddItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) { setShowAddItem(false); setPhotos([]); setPhotoPreviews([]) } }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>Agregar artículo</h2>
                <button onClick={() => { setShowAddItem(false); setPhotos([]); setPhotoPreviews([]) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>✕</button>
              </div>
              <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Título *</label>
                  <input required value={itemForm.title} onChange={setItem('title')} placeholder="Ej: Silla de auto Graco 0-13kg" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Categoría *</label>
                    <select value={itemForm.category} onChange={setItem('category')} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--navy-border)', fontSize: 14 }}>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Estado *</label>
                    <select value={itemForm.condition} onChange={setItem('condition')} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--navy-border)', fontSize: 14 }}>
                      {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Marca</label>
                    <input value={itemForm.brand} onChange={setItem('brand')} placeholder="Nike, Graco..." />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Talla / Tamaño</label>
                    <input value={itemForm.size} onChange={setItem('size')} placeholder="3-6m, Talla 2..." />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Color</label>
                  <input value={itemForm.color} onChange={setItem('color')} placeholder="Azul marino" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Descripción</label>
                  <textarea value={itemForm.description} onChange={setItem('description') as any} placeholder="Describe el artículo, cualquier detalle importante..." rows={3}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--navy-border)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Precio sugerido (MXN)</label>
                  <input type="number" value={itemForm.selling_price} onChange={setItem('selling_price')} placeholder="El equipo revisará y ajustará si es necesario" min="0" />
                </div>

                {/* Photos */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
                    Fotos del artículo <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(máx. 6)</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {photoPreviews.map((src, i) => (
                      <div key={i} style={{ position: 'relative', paddingBottom: '100%', background: '#f5f5f5', borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--navy-border)' }}>
                        <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => removePhoto(i)}
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.55)', border: 'none', borderRadius: 99, width: 22, height: 22, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                          ✕
                        </button>
                      </div>
                    ))}
                    {photos.length < 6 && (
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        style={{ paddingBottom: '100%', position: 'relative', background: 'var(--navy-light)', border: '2px dashed var(--navy-border)', borderRadius: 10, cursor: 'pointer', display: 'block', width: '100%' }}>
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span style={{ fontSize: 22 }}>📷</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Agregar</span>
                        </span>
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoSelect} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    JPG, PNG o HEIC · Máximo 6 fotos · Buena iluminación ayuda a vender más rápido
                  </div>
                </div>

                {itemError && <div style={{ background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#d42b2b' }}>{itemError}</div>}
                {uploading && (
                  <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0958d9' }}>
                    📤 Subiendo fotos... no cierres esta ventana
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowAddItem(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={addItemMutation.isPending || uploading}>
                    {uploading ? 'Subiendo fotos...' : addItemMutation.isPending ? 'Enviando...' : 'Enviar a revisión'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Not authenticated ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-light) 0%, #fff 70%)', padding: '48px 24px', textAlign: 'center', borderBottom: '1px solid var(--navy-border)' }}>
        <img src="/logo.png" alt="El Ropero de Mar" style={{ height: 72, marginBottom: 16 }} />
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--navy)', margin: '0 0 10px' }}>
          Vende con El Ropero de Mar
        </h1>
        <p style={{ fontSize: 16, color: 'var(--muted)', maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.7 }}>
          Dale una segunda vida a la ropa y artículos que tus hijos ya no usan.<br />
          Tú traes tus piezas — nosotros nos encargamos de todo lo demás.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['📦 Entrega tus artículos', '✅ Nosotros los publicamos', '💰 Tú recibes el 70%'].map(s => (
            <div key={s} style={{ background: '#fff', border: '1.5px solid var(--navy-border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{s}</div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 16px 48px' }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, border: '1.5px solid var(--navy-border)', borderRadius: 10, overflow: 'hidden' }}>
          {(['register', 'login'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: mode === m ? 'var(--navy)' : '#fff', color: mode === m ? '#fff' : 'var(--muted)' }}>
              {m === 'register' ? 'Registrarme' : 'Ya tengo cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nombre completo *</label>
              <input required value={form.full_name} onChange={set('full_name')} placeholder="María González" />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>WhatsApp (con código de país) *</label>
            <input required value={form.phone} onChange={set('phone')} placeholder="+525512345678" />
          </div>
          {mode === 'register' && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Email *</label>
                <input type="email" required value={form.email} onChange={set('email')} placeholder="tu@email.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Colonia *</label>
                <input required value={form.neighborhood} onChange={set('neighborhood')} placeholder="Colonia Roma" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Banco (opcional)</label>
                  <input value={form.bank_name} onChange={set('bank_name')} placeholder="BBVA" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>CLABE (opcional)</label>
                  <input value={form.clabe} onChange={set('clabe')} placeholder="18 dígitos" />
                </div>
              </div>
            </>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Contraseña *</label>
            <input type="password" required value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" />
          </div>

          {error && <div style={{ background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#d42b2b' }}>{error}</div>}
          {success && <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#389e0d' }}>{success}</div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}
            disabled={registerMutation.isPending || loginMutation.isPending}>
            {mode === 'register' ? 'Crear cuenta de vendedora' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
