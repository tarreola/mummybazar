import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
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
export const getDashboardSummary = () => api.get('/dashboard/summary')
export const getRevenueByMonth = (months = 6) =>
  api.get(`/dashboard/revenue-by-month?months=${months}`)

// ── Sellers ───────────────────────────────────────────────────────────────────
export const getSellers = () => api.get('/sellers/')
export const getSeller = (id: number) => api.get(`/sellers/${id}`)
export const createSeller = (data: object) => api.post('/sellers/', data)
export const updateSeller = (id: number, data: object) => api.patch(`/sellers/${id}`, data)

// ── Buyers ────────────────────────────────────────────────────────────────────
export const getBuyers = () => api.get('/buyers/')
export const getBuyer = (id: number) => api.get(`/buyers/${id}`)
export const createBuyer = (data: object) => api.post('/buyers/', data)
export const updateBuyer = (id: number, data: object) => api.patch(`/buyers/${id}`, data)

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
