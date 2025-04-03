"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Sidebar from "./sidebar"
import ChatArea from "./chat-area"
import AuthModal from "./auth-modal"
import AccountSelector from "./account-selector"
import type { Chat, Message, Account } from "../lib/types"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth-context"
import { LogOut, User, RefreshCw } from "lucide-react"

// Key for storing the selected account in localStorage
const SELECTED_ACCOUNT_KEY = "telegram_selected_account"

export default function TelegramInterface() {
  const { user, logout } = useAuth()
  const router = useRouter()

  // Authentication and accounts
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] = useState(false)
  const [reloginPhone, setReloginPhone] = useState<string | null>(null)

  // Chats and messages
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState({
    accounts: false,
    chats: false,
    messages: false,
    sending: false,
    refreshing: false,
  })
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline" | "error">("checking")
  const [endpointMissing, setEndpointMissing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Check backend status on component mount
  useEffect(() => {
    checkBackendStatus()
  }, [])

  // Fetch accounts when backend is online
  useEffect(() => {
    if (backendStatus === "online") {
      fetchAccounts()
    }
  }, [backendStatus])

  // Fetch chats when an account is selected
  useEffect(() => {
    if (selectedAccount && backendStatus === "online") {
      // Clear previous chat selection and messages when changing accounts
      setSelectedChat(null)
      setMessages([])
      setChats([])

      // Fetch chats for the new account
      fetchChats()

      // Save the selected account to localStorage whenever it changes
      localStorage.setItem(SELECTED_ACCOUNT_KEY, selectedAccount.phone)
    }
  }, [selectedAccount, backendStatus])

  // Fetch messages when a chat is selected
  useEffect(() => {
    if (selectedChat && selectedAccount && backendStatus === "online") {
      fetchMessages()
    } else {
      // Clear messages when no chat is selected
      setMessages([])
    }
  }, [selectedChat, backendStatus])

  // Update chat list periodically to check for new messages
  useEffect(() => {
    if (!selectedAccount || backendStatus !== "online") return

    const intervalId = setInterval(() => {
      fetchChats(false) // silent update (no loading indicator)
    }, 30000) // every 30 seconds

    return () => clearInterval(intervalId)
  }, [selectedAccount, backendStatus])

  // Check if backend is running
  const checkBackendStatus = async () => {
    setBackendStatus("checking")
    setErrorMessage(null)
    try {
      const isOnline = await api.checkBackendStatus()
      setBackendStatus(isOnline ? "online" : "offline")
    } catch (error: any) {
      console.error("Error checking backend status:", error)
      setBackendStatus("error")
      setErrorMessage(error.message || "Failed to connect to the backend server")
    }
  }

  const fetchAccounts = async () => {
    setLoading((prev) => ({ ...prev, accounts: true }))
    setErrorMessage(null)
    try {
      const fetchedAccounts = await api.listAccounts("telegram")
      setAccounts(fetchedAccounts)

      // Get the last selected account from localStorage
      const savedAccountPhone = localStorage.getItem(SELECTED_ACCOUNT_KEY)

      if (savedAccountPhone && fetchedAccounts.length > 0) {
        // Find the saved account in the fetched accounts
        const savedAccount = fetchedAccounts.find((account : Account) => account.phone === savedAccountPhone)

        if (savedAccount) {
          // If the saved account exists in the fetched accounts, select it
          setSelectedAccount(savedAccount)
        } else if (fetchedAccounts.length > 0) {
          // If the saved account doesn't exist anymore, select the first account
          setSelectedAccount(fetchedAccounts[0])
        }
      } else if (fetchedAccounts.length > 0) {
        // If no saved account or no accounts, select the first account
        setSelectedAccount(fetchedAccounts[0])
      }
    } catch (error: any) {
      console.error("Failed to fetch accounts:", error)
      setErrorMessage(error.message || "Failed to fetch accounts")
      if (!error.response) {
        setBackendStatus("error")
      }
    } finally {
      setLoading((prev) => ({ ...prev, accounts: false }))
    }
  }

  const fetchChats = async (showLoading = true) => {
    if (!selectedAccount) return

    if (showLoading) {
      setLoading((prev) => ({ ...prev, chats: true }))
    }
    setErrorMessage(null)

    try {
      const fetchedChats = await api.getChats(selectedAccount.phone)

      // Update the selected chat if it exists in the new list
      if (selectedChat) {
        const updatedSelectedChat = fetchedChats.find((chat: Chat) => chat.id === selectedChat.id)
        if (updatedSelectedChat) {
          setSelectedChat(updatedSelectedChat)
        }
      }

      setChats(fetchedChats)
    } catch (error: any) {
      console.error("Failed to fetch chats:", error)

      // Handle session invalid error
      if (error.response?.status === 401 && error.response?.data?.detail?.includes("Session is no longer valid")) {
        setErrorMessage("Your Telegram session is no longer valid. Please log in again.")

        // Remove the invalid account from the list
        setAccounts((prev) => prev.filter((acc) => acc.phone !== selectedAccount.phone))

        // Set the phone number for re-login
        setReloginPhone(selectedAccount.phone)

        // Open the auth modal
        setIsAuthModalOpen(true)

        // Clear selected account if it's the invalid one
        if (selectedAccount.phone === selectedAccount.phone) {
          setSelectedAccount(null)
          localStorage.removeItem(SELECTED_ACCOUNT_KEY)
        }

        return
      }

      setErrorMessage(error.message || "Failed to fetch chats")
      if (!error.response) {
        setBackendStatus("error")
      }
    } finally {
      if (showLoading) {
        setLoading((prev) => ({ ...prev, chats: false }))
      }
    }
  }

  const fetchMessages = async () => {
    if (!selectedAccount || !selectedChat) return

    setLoading((prev) => ({ ...prev, messages: true }))
    setEndpointMissing(false)
    setErrorMessage(null)

    try {
      try {
        const fetchedMessages = await api.getMessages(selectedAccount.phone, selectedChat.id)

        // Format messages for display
        const formattedMessages = fetchedMessages.map((msg: any) => {
          const date = new Date(msg.date)
          const time = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })

          return {
            ...msg,
            time,
            status: "read", // Assume all messages are read
          }
        })

        setMessages(formattedMessages)
      } catch (error: any) {
        console.error("Error fetching messages:", error)

        // Handle session invalid error
        if (error.response?.status === 401 && error.response?.data?.detail?.includes("Session is no longer valid")) {
          setErrorMessage("Your Telegram session is no longer valid. Please log in again.")

          // Remove the invalid account from the list
          setAccounts((prev) => prev.filter((acc) => acc.phone !== selectedAccount.phone))

          // Set the phone number for re-login
          setReloginPhone(selectedAccount.phone)

          // Open the auth modal
          setIsAuthModalOpen(true)

          // Clear selected account if it's the invalid one
          if (selectedAccount.phone === selectedAccount.phone) {
            setSelectedAccount(null)
            localStorage.removeItem(SELECTED_ACCOUNT_KEY)
          }

          return
        }

        if (!error.response) {
          setBackendStatus("error")
          setErrorMessage(error.message || "Network error when fetching messages")
          setMessages([])
          return
        }

        // Check if it's a 404 error (endpoint not found)
        if (error.response && error.response.status === 404) {
          setEndpointMissing(true)

          // Use mock data for demonstration
          const mockMessages: Message[] = [
            {
              id: 1,
              text: `This is a placeholder message. The get_messages endpoint is missing.`,
              date: new Date().toISOString(),
              out: false,
              sender_id: 0,
              time: "12:30 PM",
              status: "read",
            },
            {
              id: 2,
              text: `To implement message fetching, add the get_messages endpoint to your backend.`,
              date: new Date().toISOString(),
              out: false,
              sender_id: 0,
              time: "12:31 PM",
              status: "read",
            },
          ]

          setMessages(mockMessages)
        } else {
          // Handle other errors
          setErrorMessage(error.message || "Error fetching messages")
          setMessages([
            {
              id: 1,
              text: `Error fetching messages: ${error.message || "Unknown error"}`,
              date: new Date().toISOString(),
              out: false,
              sender_id: 0,
              time: "12:30 PM",
              status: "read",
            },
          ])
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch messages:", error)
      setErrorMessage(error.message || "Failed to fetch messages")
    } finally {
      setLoading((prev) => ({ ...prev, messages: false }))
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedAccount || !selectedChat || loading.sending) return

    setLoading((prev) => ({ ...prev, sending: true }))
    setErrorMessage(null)

    // Create a new message object
    const tempId = Date.now()
    const now = new Date()
    const newMsg: Message = {
      id: tempId,
      text: newMessage,
      date: now.toISOString(),
      out: true,
      sender_id: 0, // We don't know our own ID, but it doesn't matter for display
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    }

    // Add the new message to the end of the messages array
    setMessages((prev) => [...prev, newMsg])
    setNewMessage("")

    try {
      // Send the message to the API
      await api.sendMessage(selectedAccount.phone, selectedChat.name, newMessage)

      // Update the message status to delivered
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...msg, status: "delivered" as const } : msg)))

      // If we have the get_messages endpoint, refresh messages after a short delay
      if (!endpointMissing) {
        setTimeout(() => {
          fetchMessages()
        }, 1000)
      }

      // Update chat list to reflect the new message
      setTimeout(() => {
        fetchChats(false)
      }, 2000)
    } catch (error: any) {
      console.error("Failed to send message:", error)

      // Handle session invalid error
      if (error.response?.status === 401 && error.response?.data?.detail?.includes("Session is no longer valid")) {
        setErrorMessage("Your Telegram session is no longer valid. Please log in again.")

        // Remove the invalid account from the list
        setAccounts((prev) => prev.filter((acc) => acc.phone !== selectedAccount.phone))

        // Set the phone number for re-login
        setReloginPhone(selectedAccount.phone)

        // Open the auth modal
        setIsAuthModalOpen(true)

        // Clear selected account if it's the invalid one
        if (selectedAccount.phone === selectedAccount.phone) {
          setSelectedAccount(null)
          localStorage.removeItem(SELECTED_ACCOUNT_KEY)
        }

        return
      }

      setErrorMessage(error.message || "Failed to send message")

      // Show error state for the message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                text: msg.text + " (failed to send)",
                status: "sent" as const,
              }
            : msg,
        ),
      )

      if (!error.response) {
        setBackendStatus("error")
      }
    } finally {
      setLoading((prev) => ({ ...prev, sending: false }))
    }
  }

  // Refresh the entire interface
  const refreshInterface = async () => {
    setLoading((prev) => ({ ...prev, refreshing: true }))
    setErrorMessage(null)

    try {
      // Check backend status first
      await checkBackendStatus()

      // Check if user is authenticated
      const token = localStorage.getItem("auth_token")
      if (!token) {
        console.log("No authentication token found during refresh")
        router.push("/login")
        return
      }

      // Fetch accounts
      await fetchAccounts()

      // If an account is selected, fetch its chats
      if (selectedAccount) {
        await fetchChats()

        // If a chat is selected, fetch its messages
        if (selectedChat) {
          await fetchMessages()
        }
      }
    } catch (error: any) {
      console.error("Failed to refresh interface:", error)

      // Handle authentication errors
      if (error.response?.status === 401) {
        setErrorMessage("Your session has expired. Please log in again.")
        setTimeout(() => {
          logout()
          router.push("/login")
        }, 3000)
        return
      }

      setErrorMessage(error.message || "Failed to refresh interface")
    } finally {
      setLoading((prev) => ({ ...prev, refreshing: false }))
    }
  }

  const handleLoginSuccess = () => {
    // Clear the relogin phone
    setReloginPhone(null)

    // Refresh accounts after successful login
    refreshInterface()
  }

  const handleSelectAccount = (account: Account) => {
    // Only update if selecting a different account
    if (selectedAccount?.phone !== account.phone) {
      setSelectedAccount(account)
    }
    setIsAccountSelectorOpen(false)
  }

  const handleAddAccount = (type: "telegram" | "whatsapp") => {
    if (type === "telegram") {
      setIsAccountSelectorOpen(false)
      setIsAuthModalOpen(true)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  // Render a backend status message if the backend is offline or has an error
  if (backendStatus === "offline" || backendStatus === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#17212b] text-white">
        <div className="text-center p-6 bg-[#242f3d] rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-4">Backend Not Available</h2>
          <p className="mb-4">
            {backendStatus === "offline"
              ? "Unable to connect to the Telegram backend server. Please make sure the server is running."
              : errorMessage || "An error occurred while connecting to the backend server."}
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={checkBackendStatus}
              className="px-4 py-2 bg-[#5288c1] text-white rounded hover:bg-[#4a7ab0] flex items-center"
            >
              <RefreshCw size={16} className="mr-2" />
              Retry Connection
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-[#242f3d] border border-[#5288c1] text-white rounded hover:bg-[#2b3b4d] flex items-center"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state while checking backend status
  if (backendStatus === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#17212b] text-white">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#5288c1] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Connecting to Telegram backend...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* User header */}
      <div className="bg-[#242f3d] p-3 flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-[#5288c1] flex items-center justify-center text-white">
            <User size={16} />
          </div>
          <span className="ml-2 text-white">{user?.username || "User"}</span>
        </div>
        <div className="flex items-center">
          <button
            onClick={refreshInterface}
            className="flex items-center text-[#8e9ba8] hover:text-white mr-4"
            disabled={loading.refreshing}
          >
            <RefreshCw size={16} className={`mr-1 ${loading.refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button onClick={handleLogout} className="flex items-center text-[#8e9ba8] hover:text-white">
            <LogOut size={16} className="mr-1" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Error message banner */}
      {errorMessage && (
        <div className="bg-red-500 bg-opacity-20 p-3 text-red-300 flex items-center justify-between">
          <div className="flex-1">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="ml-2 text-red-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Main interface */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with chats */}
        <Sidebar
          chats={chats}
          selectedChat={selectedChat}
          onSelectChat={setSelectedChat}
          loading={loading.chats || loading.refreshing}
          selectedAccount={selectedAccount}
          onOpenAccountSelector={() => setIsAccountSelectorOpen(true)}
        />

        {/* Main chat area */}
        <ChatArea
          chat={selectedChat}
          messages={messages}
          newMessage={newMessage}
          onNewMessageChange={setNewMessage}
          onSendMessage={handleSendMessage}
          loading={loading.messages || loading.refreshing}
          endpointMissing={endpointMissing}
        />

        {/* Authentication modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            setIsAuthModalOpen(false)
            setReloginPhone(null)
          }}
          onLoginSuccess={handleLoginSuccess}
          initialPhone={reloginPhone}
        />

        {/* Account selector */}
        <AccountSelector
          isOpen={isAccountSelectorOpen}
          onClose={() => setIsAccountSelectorOpen(false)}
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={handleSelectAccount}
          onAddAccount={handleAddAccount}
        />
      </div>
    </div>
  )
}

