import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_DB}/api`,
  withCredentials: true,
})

let isRefreshing = false
const retryQueue: Array<{
  resolve: (value: unknown) => void
  reject:  (reason: unknown) => void
}> = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config as typeof error.config & { _retry?: boolean }

    if (
      error.response?.status === 401 &&
      !orig._retry &&
      !orig.url?.includes('/auth/')
    ) {
      orig._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          retryQueue.push({ resolve, reject })
        }).then(() => api(orig))
      }

      isRefreshing = true
      try {
        await api.post('/auth/refresh')
        retryQueue.forEach(({ resolve }) => resolve(null))
        retryQueue.length = 0
        return api(orig)
      } catch (e) {
        retryQueue.forEach(({ reject }) => reject(e))
        retryQueue.length = 0
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
