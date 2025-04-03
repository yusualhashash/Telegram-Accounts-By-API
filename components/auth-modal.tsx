"use client"

import { useState, useEffect } from "react"
import { api } from "../lib/api"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: () => void
  initialPhone?: string | null
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess, initialPhone = null }: AuthModalProps) {
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  // Set initial phone if provided
  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone)
    }
  }, [initialPhone])

  if (!isOpen) return null

  const handleStartLogin = async () => {
    if (!phone) {
      setError("Please enter a phone number")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await api.startLogin(phone)
      setMessage(response.message)
      setStep("code")
    } catch (err: any) {
      setError(err.message || "Failed to start login")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteLogin = async () => {
    if (!code) {
      setError("Please enter the verification code")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await api.completeLogin(phone, code)
      setMessage(response.message)

      // Reset the form
      setPhone("")
      setCode("")
      setStep("phone")

      // Close the modal and notify parent of success
      setTimeout(() => {
        onLoginSuccess()
        onClose()
      }, 1500) // Short delay to show success message
    } catch (err: any) {
      setError(err.message || "Failed to complete login")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    // Reset the form when closing
    setPhone("")
    setCode("")
    setStep("phone")
    setError("")
    setMessage("")
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#17212b] rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-4">
          {step === "phone" ? "Login to Telegram" : "Enter Verification Code"}
        </h2>

        {message && <div className="mb-4 p-3 bg-[#2b5278] text-white rounded">{message}</div>}

        {error && <div className="mb-4 p-3 bg-red-500 bg-opacity-20 text-red-300 rounded">{error}</div>}

        {step === "phone" ? (
          <>
            <div className="mb-4">
              <label className="block text-[#8e9ba8] mb-2">Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +905312400068"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 bg-[#242f3d] text-white rounded border border-[#0e1621] focus:outline-none focus:border-[#5288c1]"
              />
              <p className="text-xs text-[#8e9ba8] mt-2">Enter your phone number in international format</p>
            </div>
            <div className="flex justify-between">
              <button onClick={handleClose} className="px-4 py-2 text-[#8e9ba8] hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleStartLogin}
                disabled={loading}
                className="px-4 py-2 bg-[#5288c1] text-white rounded hover:bg-[#4a7ab0] disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-[#8e9ba8] mb-2">Verification Code</label>
              <input
                type="text"
                placeholder="Enter code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2 bg-[#242f3d] text-white rounded border border-[#0e1621] focus:outline-none focus:border-[#5288c1]"
              />
              <p className="text-xs text-[#8e9ba8] mt-2">Enter the code sent to your Telegram app</p>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep("phone")} className="px-4 py-2 text-[#8e9ba8] hover:text-white">
                Back
              </button>
              <button
                onClick={handleCompleteLogin}
                disabled={loading}
                className="px-4 py-2 bg-[#5288c1] text-white rounded hover:bg-[#4a7ab0] disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

