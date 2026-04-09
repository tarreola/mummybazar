import { createContext, useContext, useState, ReactNode } from 'react'
import { login as apiLogin } from '../api/client'

interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('mb_token')
  )

  const signIn = async (email: string, password: string) => {
    const res = await apiLogin(email, password)
    const t = res.data.access_token
    localStorage.setItem('mb_token', t)
    setToken(t)
  }

  const signOut = () => {
    localStorage.removeItem('mb_token')
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
