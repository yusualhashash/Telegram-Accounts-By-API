"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "../../lib/auth-context"
import TelegramInterface from "../../components/telegram-interface"


export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#17212b] text-white">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#5288c1] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, don't render anything (will redirect)
  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-[#17212b]">
      <TelegramInterface />
    </main>
  )
}

