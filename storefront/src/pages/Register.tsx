import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { registerBuyer, registerSeller } from '../api/client'
import { useAuth } from '../store/auth'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [role] = useState<'buyer' | 'seller'>('seller')
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', password: '', password2: '',
    neighborhood: '', city: 'Ciudad de México', bank_name: '', clabe: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.password2) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    try {
      const fn = role === 'buyer' ? registerBuyer : registerSeller
      const res = await fn({
        full_name: form.full_name, phone: form.phone, email: form.email || undefined,
        password: form.password, neighborhood: form.neighborhood || undefined,
        city: form.city,
        ...(role === 'seller' ? { bank_name: form.bank_name || undefined, clabe: form.clabe || undefined } : {}),
      })
      login(res.data.access_token, { name: res.data.name, role, is_approved: res.data.is_approved })
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al registrarse. Intenta de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 40, paddingBottom: 60 }}>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🏷️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)' }}>Registrarme como vendedora</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Vende tus artículos en MommyBazar
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nombre completo *</label>
            <input required value={form.full_name} onChange={set('full_name')} placeholder="María González" />
          </div>
          <div className="form-group">
            <label>WhatsApp (con código de país) *</label>
            <input required value={form.phone} onChange={set('phone')} placeholder="+525512345678" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="maria@email.com" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label>Contraseña *</label>
              <input required type="password" value={form.password} onChange={set('password')} placeholder="Mín. 6 caracteres" />
            </div>
            <div className="form-group">
              <label>Confirmar contraseña *</label>
              <input required type="password" value={form.password2} onChange={set('password2')} placeholder="Repite tu contraseña" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label>Colonia</label>
              <input value={form.neighborhood} onChange={set('neighborhood')} placeholder="Polanco" />
            </div>
            <div className="form-group">
              <label>Ciudad</label>
              <input value={form.city} onChange={set('city')} />
            </div>
          </div>

          <div style={{ background: 'var(--pink-light)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pink)', marginBottom: 10 }}>
              💸 Datos de pago (para recibir tus ganancias)
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Banco</label>
              <input value={form.bank_name} onChange={set('bank_name')} placeholder="BBVA, Santander…" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>CLABE interbancaria</label>
              <input value={form.clabe} onChange={set('clabe')} placeholder="18 dígitos" />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#cf1322' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 14, marginTop: 8 }} disabled={loading}>
            {loading ? 'Creando cuenta…' : 'Crear mi cuenta 🌸'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--pink)', fontWeight: 600 }}>Inicia sesión</Link>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: '#fffbe6', borderRadius: 8, fontSize: 12, color: '#7c6000' }}>
          ℹ️ Tu registro quedará pendiente de aprobación del equipo MommyBazar. Te contactaremos por WhatsApp para activar tu cuenta.
        </div>
      </div>
    </div>
  )
}
