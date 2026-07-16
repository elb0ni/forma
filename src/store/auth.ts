import { create } from 'zustand'
import type { AuthUser } from '../types'

interface AuthStore {
  user:          AuthUser | null
  isInitialized: boolean
  setUser:        (user: AuthUser) => void
  clearUser:      () => void
  setInitialized: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:          null,
  isInitialized: false,
  setUser:        (user) => set({ user }),
  clearUser:      () => set({ user: null }),
  setInitialized: () => set({ isInitialized: true }),
}))
