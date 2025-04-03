export interface Chat {
  id: number
  name: string
  unread_count: number
  avatar?: string
  lastMessage?: string
  online?: boolean
}

export interface Message {
  id: number
  text: string
  date: string
  out: boolean
  sender_id: number
  reply_to_msg_id?: number
  // UI-specific properties
  time?: string
  status?: "sent" | "delivered" | "read"
}

export interface Account {
  phone: string
  isActive?: boolean
}

