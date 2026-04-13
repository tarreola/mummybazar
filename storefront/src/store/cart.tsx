import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export interface CartItem {
  id: number
  title: string
  price: number
  image?: string
  sku?: string
}

interface CartCtx {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (id: number) => void
  has: (id: number) => boolean
  count: number
  clear: () => void
}

const Ctx = createContext<CartCtx>(null!)

function load(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('mb_cart') || '[]') } catch { return [] }
}
function save(items: CartItem[]) {
  localStorage.setItem('mb_cart', JSON.stringify(items))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)

  const add = useCallback((item: CartItem) => {
    setItems(prev => {
      if (prev.find(i => i.id === item.id)) return prev
      const next = [...prev, item]
      save(next)
      return next
    })
  }, [])

  const remove = useCallback((id: number) => {
    setItems(prev => { const next = prev.filter(i => i.id !== id); save(next); return next })
  }, [])

  const has = useCallback((id: number) => items.some(i => i.id === id), [items])

  const clear = useCallback(() => { setItems([]); save([]) }, [])

  return (
    <Ctx.Provider value={{ items, add, remove, has, count: items.length, clear }}>
      {children}
    </Ctx.Provider>
  )
}

export const useCart = () => useContext(Ctx)
