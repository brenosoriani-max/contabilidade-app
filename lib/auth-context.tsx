"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { authService } from '@/lib/api/services'
import type { AuthUser } from '@/types'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

 useEffect(() => {
  const checkSession = async () => {
    try {
      const data = await authService.me()
      setUser(data.user)
    } catch {
      
    } finally {
      setIsLoading(false)
    }
  }
  checkSession()
}, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await authService.login(email, password)
      setUser(data.user)
      return { success: true }
    } catch (error) {
      console.error('Login failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexao',
      }
    }
  }, [])

  const logout = useCallback(() => {
    void authService.logout().finally(() => setUser(null))
  }, [])

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
