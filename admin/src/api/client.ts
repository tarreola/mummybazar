import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mb_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mb_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post<{ access_token: string }>('/auth/login', { email, password })

// ── Dashboard ─────────────────────────────────────────────────────────────────
export type DashboardPeriod = 'TODAY' | 'WTD' | 'MTD' | 'QTD' | 'YTD' | 'CUSTOM'

export const getDashboardSummary = (params?: {
  period?: DashboardPeriod
  date_from?: string
  date_to?: string
}) => api.get('/dashboard/summary', { params })

export const getRevenueByMonth = (months = 6) =>
  api.get(`/dashboard/revenue-by-month?months=${months}`)

export const getDashboardTopSellers = (period: DashboardPeriod, dateFrom?: string, dateTo?: string) =>
  api.get('/dashboard/top-sellers', { params: { limit: 5, period, date_from: dateFrom, date_to: dateTo } })

export const getDashboardTopBuyers = (period: DashboardPeriod, dateFrom?: string, dateTo?: string) =>
  api.get('/dashboard/top-buyers', { params: { limit: 5, period, date_from: dateFrom, date_to: dateTo } })

export const getDashboardByCategory = (period: DashboardPeriod, dateFrom?: string, dateTo?: string) =>
  api.get('/dashboard/sales-by-category', { params: { period, date_from: dateFrom, date_to: dateTo } })

// ── Sellers ───────────────────────────────────────────────────────────────────
export const getSellers = () => api.get('/sellers/')
export const getSeller = (id: number) => api.get(`/sellers/${id}`)
export const createSeller = (data: object) => api.post('/sellers/', data)
export const updateSeller = (id: number, data: object) => api.patch(`/sellers/${id}`, data)
export const approveSeller = (id: number) => api.post(`/sellers/${id}/approve`)

// ── Buyers ────────────────────────────────────────────────────────────────────
export const getBuyers = () => api.get('/buyers/')
export const getBuyer = (id: number) => api.get(`/buyers/${id}`)
export const createBuyer = (data: object) => api.post('/buyers/', data)
export const updateBuyer = (id: number, data: object) => api.patch(`/buyers/${id}`, data)
export const approveBuyer = (id: number) => api.post(`/buyers/${id}/approve`)

// ── Items ─────────────────────────────────────────────────────────────────────
export const getItems = (params?: object) => api.get('/items/', { params })
export const getItem = (id: number) => api.get(`/items/${id}`)
export const createItem = (data: object) => api.post('/items/', data)
export const updateItem = (id: number, data: object) => api.patch(`/items/${id}`, data)
export const uploadItemImage = (id: number, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/items/${id}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const deleteItemImage = (id: number, url: string) =>
  api.delete(`/items/${id}/images`, { params: { url } })

// ── Orders ────────────────────────────────────────────────────────────────────
export const getOrders = (params?: object) => api.get('/orders/', { params })
export const getOrder = (id: number) => api.get(`/orders/${id}`)
export const createOrder = (data: object) => api.post('/orders/', data)
export const updateOrder = (id: number, data: object) => api.patch(`/orders/${id}`, data)

// ── WhatsApp ──────────────────────────────────────────────────────────────────
export const getMessages = () => api.get('/whatsapp/messages')
export const sendMessage = (data: object) => api.post('/whatsapp/send', data)

export default api
