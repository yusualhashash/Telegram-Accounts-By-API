import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

// Create axios instance with auth header
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
})

// Add auth token to requests if available
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add response interceptor to handle common errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNABORTED") {
      console.error("Request timeout:", error)
      return Promise.reject(new Error("Request timed out. Please check your connection."))
    }

    if (!error.response) {
      console.error("Network error:", error)
      return Promise.reject(new Error("Network error. Please check if the backend server is running."))
    }

    return Promise.reject(error)
  },
)

export const api = {
  // Authentication
  login: async (email: string, password: string) => {
    try {
      // For login, we need to use the OAuth2 format that FastAPI expects
      const formData = new FormData()
      formData.append("username", email) // FastAPI OAuth2 uses 'username' field
      formData.append("password", password)

      const response = await axios.post(`${API_BASE_URL}/login/`, formData)

      // Make sure the token is properly stored
      if (response.data && response.data.token) {
        localStorage.setItem("auth_token", response.data.token)
        console.log("Token stored successfully:", response.data.token.substring(0, 10) + "...")
      } else {
        console.error("No token received from server")
      }

      return response.data
    } catch (error: any) {
      if (!error.response) {
        throw new Error("Network error. Please check if the backend server is running.")
      }
      throw error
    }
  },

  register: async (username: string, email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/register/`, { username, email, password })
      return response.data
    } catch (error: any) {
      if (!error.response) {
        throw new Error("Network error. Please check if the backend server is running.")
      }
      throw error
    }
  },

  getCurrentUser: async () => {
    try {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await axiosInstance.get(`${API_BASE_URL}/me/`)
      return response.data.user
    } catch (error: any) {
      console.error("Failed to get current user:", error)
      if (error.response?.status === 401) {
        // Token is invalid or expired
        localStorage.removeItem("auth_token")
      }
      throw error
    }
  },

  // Telegram Authentication
  startLogin: async (phone: string) => {
    try {
      const response = await axiosInstance.post(`${API_BASE_URL}/start_login/`, {
        phone,
        force_code: true, // Always request a verification code
      })
      return response.data
    } catch (error: any) {
      if (!error.response) {
        throw new Error("Network error. Please check if the backend server is running.")
      }
      throw error
    }
  },

  completeLogin: async (phone: string, code: string) => {
    try {
      const response = await axiosInstance.post(`${API_BASE_URL}/complete_login/`, {
        phone,
        code,
        // No longer passing already_authorized flag
      })
      return response.data
    } catch (error: any) {
      if (!error.response) {
        throw new Error("Network error. Please check if the backend server is running.")
      }
      throw error
    }
  },

  // Account management
  listAccounts: async (type?: string) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/list_accounts/`, {
        params: type ? { type } : undefined,
      })

      // Convert string array to Account array if needed
      if (Array.isArray(response.data.accounts) && typeof response.data.accounts[0] === "string") {
        return response.data.accounts.map((phone: string) => ({ phone }))
      }

      return response.data.accounts
    } catch (error: any) {
      console.error("Failed to list accounts:", error)
      if (!error.response) {
        console.error("Network error when listing accounts")
      }
      return []
    }
  },

  // Chats and messages
  getChats: async (phone: string) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/get_chats/`, {
        params: { phone },
      })

      // Filter out time data from chats if it exists
      const chats = response.data.chats.map((chat: any) => {
        const { time, ...chatWithoutTime } = chat
        return chatWithoutTime
      })

      return chats
    } catch (error: any) {
      console.error(`Failed to get chats for ${phone}:`, error)
      if (!error.response) {
        throw new Error("Network error. Please check if the backend server is running.")
      }
      throw error
    }
  },

  getMessages: async (phone: string, chatId: number) => {
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/get_messages/`, {
        params: {
          phone,
          chat_id: chatId,
          limit: 50,
        },
      })
      return response.data.messages
    } catch (error: any) {
      if (!error.response) {
        throw new Error("Network error. Please check if the backend server is running.")
      }
      throw error
    }
  },

  sendMessage: async (phone: string, recipient: string, message: string) => {
    try {
      const response = await axiosInstance.post(`${API_BASE_URL}/send_message/`, {
        phone,
        recipient,
        message,
      })
      return response.data
    } catch (error: any) {
      if (!error.response) {
        throw new Error("Network error. Please check if the backend server is running.")
      }
      throw error
    }
  },

  // Helper function to check if the backend is running
  checkBackendStatus: async () => {
    try {
      // Try to access an endpoint that doesn't require authentication
      await axios.get(`${API_BASE_URL}/health/`, { timeout: 5000 })
      return true
    } catch (error) {
      console.error("Backend not available:", error)
      return false
    }
  },
}

