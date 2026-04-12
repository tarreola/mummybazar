import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/storefront` : '/api/v1/storefront'

const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mb_sf_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mb_sf_token')
      localStorage.removeItem('mb_sf_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const getItems = (params?: object) => api.get('/items', { params })
export const getItem  = (id: number)      => api.get(`/items/${id}`)

export const registerBuyer  = (data: object) => api.post('/register/buyer', data)
export const registerSeller = (data: object) => api.post('/register/seller', data)
export const login          = (data: object) => api.post('/login', data)
export const getMe          = ()             => api.get('/me')
export const getMyOrders    = ()             => api.get('/my-orders')
export const getMyItems     = ()             => api.get('/my-items')
export const checkout       = (data: object) => api.post('/checkout', data)

export default api
