import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { login as apiLogin } from '../api/client'
import { useAuth } from '../store/auth'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login } = useAuth()
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const redirect = params.get('redirect') || '/'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiLogin({ phone, password, role })
      login(res.data.access_token, { name: res.data.name, role, is_approved: res.data.is_approved })
      navigate(redirect)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Número o contraseña incorrectos')
    }
    setLoading(false)
  }

  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 60, paddingBottom: 60 }}>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>💖</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)' }}>Iniciar sesión</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Bienvenida de vuelta 🌸</p>
        </div>

        {/* Role selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          {(['buyer', 'seller'] as const).map(r => (
            <button key={r} type="button"
              onClick={() => setRole(r)}
              style={{
                padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                border: `2px solid ${role === r ? 'var(--pink)' : 'var(--pink-border)'}`,
                background: role === r ? 'var(--pink-light)' : '#fff',
                color: role === r ? 'var(--pink)' : 'var(--muted)',
              }}>
              {r === 'buyer' ? '🛍️ Compradora' : '🏷️ Vendedora'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>WhatsApp (con código de país)</label>
            <input required value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+525512345678" />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña" />
          </div>

          {error && (
            <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#cf1322' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 14, marginTop: 4 }} disabled={loading}>
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" style={{ color: 'var(--pink)', fontWeight: 600 }}>Regístrate aquí</Link>
        </div>
      </div>
    </div>
  )
}
