import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { registerSeller, login as sfLogin, getMyItems } from '../api/client'

const STATUS_LABEL: Record<string, string> = { received: 'Recibido', inspected: 'Inspeccionado', listed: 'Publicado', sold: 'Vendido', shipped: 'Enviado', delivered: 'Entregado', returned: 'Devuelto', archived: 'Donado' }
const STATUS_COLOR: Record<string, string> = { received: '#1677ff', inspected: '#13c2c2', listed: '#52c41a', sold: '#faad14', shipped: '#fa8c16', delivered: '#722ed1', returned: '#f5222d', archived: '#d9d9d9' }

export default function Vende() {
  const { isAuthenticated, user, login } = useAuth()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', neighborhood: '', bank_name: '', clabe: '' })

  // My items (if logged in as seller)
  const { data: myItems = [] } = useQuery({
    queryKey: ['my-items'],
    queryFn: () => getMyItems().then(r => r.data),
    enabled: isAuthenticated && user?.role === 'seller',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (mode === 'register') registerMutation.mutate()
    else loginMutation.mutate()
  }

  // ── Logged in as seller ──────────────────────────────────────────────────────
  if (isAuthenticated && user?.role === 'seller') {
    const listed = myItems.filter((i: any) => i.status === 'listed').length
    const sold   = myItems.filter((i: any) => ['sold', 'shipped', 'delivered'].includes(i.status)).length
    return (
      <div className="container" style={{ paddingTop: 32, paddingBottom: 48, maxWidth: 800 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--navy-light) 0%, #fff 70%)', border: '1px solid var(--navy-border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 28 }}>🌸</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)', margin: '8px 0 4px' }}>
            Hola, {user.name.split(' ')[0]}
          </h1>
          {!user.is_approved && (
            <div style={{ background: '#fff7e6', border: '1px solid #ffe58f', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#d46b08', marginTop: 8 }}>
              ⏳ Tu cuenta está en revisión. Te avisaremos cuando sea aprobada.
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total artículos', value: myItems.length, color: 'var(--navy)' },
            { label: 'Publicados', value: listed, color: '#52c41a' },
            { label: 'Vendidos', value: sold, color: '#faad14' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Items list */}
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', marginBottom: 14 }}>Mis artículos</h2>
        {myItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            Aún no tienes artículos registrados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myItems.map((item: any) => (
              <div key={item.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 50, height: 62, background: 'var(--navy-light)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  {item.images?.[0]
                    ? <img src={item.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🧸</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.sku}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>${Number(item.selling_price).toLocaleString('es-MX')}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: STATUS_COLOR[item.status] + '20', color: STATUS_COLOR[item.status] || '#595959' }}>
                    {STATUS_LABEL[item.status] || item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Not authenticated: register / login ──────────────────────────────────────
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
