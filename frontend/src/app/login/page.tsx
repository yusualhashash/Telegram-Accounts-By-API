"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "../../../lib/auth-context"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await login(email, password)
      router.push("/")
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to login. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#17212b]">
      <div className="w-full max-w-md p-8 bg-[#242f3d] rounded-lg shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Login to Your Account</h1>
          <p className="text-[#8e9ba8] mt-2">Access your Telegram accounts</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500 bg-opacity-20 text-red-300 rounded">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-[#8e9ba8] mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-[#17212b] text-white rounded border border-[#0e1621] focus:outline-none focus:border-[#5288c1]"
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-[#8e9ba8] mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#17212b] text-white rounded border border-[#0e1621] focus:outline-none focus:border-[#5288c1]"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#5288c1] text-white rounded hover:bg-[#4a7ab0] disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[#8e9ba8]">
            Don't have an account?{" "}
            <Link href="/register" className="text-[#5288c1] hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

