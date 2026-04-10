import { createContext, useContext, useState, ReactNode } from 'react'

interface SfUser { name: string; role: 'buyer' | 'seller'; is_approved: boolean }

interface AuthCtx {
  user: SfUser | null
  token: string | null
  login: (token: string, user: SfUser) => void
  logout: () => void
  isAuthenticated: boolean
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mb_sf_token'))
  const [user, setUser] = useState<SfUser | null>(() => {
    const s = localStorage.getItem('mb_sf_user')
    return s ? JSON.parse(s) : null
  })

  const login = (t: string, u: SfUser) => {
    localStorage.setItem('mb_sf_token', t)
    localStorage.setItem('mb_sf_user', JSON.stringify(u))
    setToken(t)
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('mb_sf_token')
    localStorage.removeItem('mb_sf_user')
    setToken(null)
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
