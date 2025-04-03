"use client"

import { Search, Menu, Moon, Settings, Loader2 } from "lucide-react"
import type { Chat, Account } from "../lib/types"
import { useState } from "react"

interface SidebarProps {
  chats: Chat[]
  selectedChat: Chat | null
  onSelectChat: (chat: Chat) => void
  loading: boolean
  selectedAccount: Account | null
  onOpenAccountSelector: () => void
}

export default function Sidebar({
  chats,
  selectedChat,
  onSelectChat,
  loading,
  selectedAccount,
  onOpenAccountSelector,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Filter chats based on search query
  const filteredChats = searchQuery
    ? chats.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : chats

  return (
    <div className="w-[320px] flex-shrink-0 bg-[#17212b] border-r border-[#0e1621] flex flex-col h-full">
      {/* Sidebar header */}
      <div className="p-3 flex items-center justify-between bg-[#17212b] border-b border-[#0e1621]">
        <button className="p-2 text-[#6c7883] hover:text-white">
          <Menu size={20} />
        </button>
        <div className="relative flex-1 mx-2">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <Search size={16} className="text-[#6c7883]" />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-1.5 pl-8 pr-3 bg-[#242f3d] text-white rounded-md text-sm focus:outline-none"
          />
        </div>
        <button className="p-2 text-[#6c7883] hover:text-white">
          <Moon size={20} />
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 size={24} className="text-[#5288c1] animate-spin" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-4 text-center">
            {searchQuery ? (
              <p className="text-[#8e9ba8] mb-4">No chats match your search</p>
            ) : (
              <p className="text-[#8e9ba8] mb-4">No chats available</p>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id || chat.name}
              className={`flex items-center p-3 cursor-pointer hover:bg-[#212d3b] ${
                selectedChat?.id === chat.id ? "bg-[#2b5278]" : ""
              }`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-[#242f3d] flex items-center justify-center text-white">
                  {chat.name.substring(0, 2).toUpperCase()}
                </div>
                {chat.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#17212b]" />
                )}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex justify-between">
                  <h3
                    className={`font-medium truncate ${selectedChat?.id === chat.id ? "text-white" : "text-[#f5f5f5]"}`}
                  >
                    {chat.name}
                  </h3>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-sm text-[#8e9ba8] truncate">{chat.lastMessage || "No messages yet"}</p>
                  {chat.unread_count > 0 && (
                    <span className="ml-2 bg-[#5288c1] text-white text-xs rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sidebar footer */}
      <div className="p-3 border-t border-[#0e1621] bg-[#17212b]">
        <div className="flex justify-between">
          <button className="flex items-center text-[#6c7883] hover:text-white">
            <Settings size={20} />
            <span className="ml-3 text-sm">Settings</span>
          </button>

          {/* Replace "New Chat" with the account button */}
          <button className="flex items-center text-[#6c7883] hover:text-white" onClick={onOpenAccountSelector}>
            <span className="ml-3 text-sm">
              {selectedAccount ? `Account: ${selectedAccount.phone}` : "Login to Telegram"}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

