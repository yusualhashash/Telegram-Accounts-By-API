"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { api } from "./api"

export interface User {
  id: string
  username: string
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("auth_token")
        if (token) {
          try {
            const userData = await api.getCurrentUser()
            setUser(userData)
          } catch (err: any) {
            console.log("Authentication error:", err.message)
            // Clear token if it's invalid or expired
            if (err.response?.status === 401) {
              console.log("Invalid or expired token, clearing local storage")
              localStorage.removeItem("auth_token")
              setUser(null)
            }
          }
        }
      } catch (err) {
        console.error("Failed to authenticate user:", err)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const { user, token } = await api.login(email, password)
      localStorage.setItem("auth_token", token)
      setUser(user)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to login")
      throw err
    } finally {
      setLoading(false)
    }
  }

  const register = async (username: string, email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const { user, token } = await api.register(username, email, password)
      localStorage.setItem("auth_token", token)
      setUser(user)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to register")
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem("auth_token")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, error }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

