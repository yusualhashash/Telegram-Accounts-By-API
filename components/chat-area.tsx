"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Paperclip, Smile, Mic, Send, MoreVertical, Phone, Video, Loader2, AlertTriangle } from "lucide-react"
import type { Chat, Message } from "../lib/types"

interface ChatAreaProps {
  chat: Chat | null
  messages: Message[]
  newMessage: string
  onNewMessageChange: (message: string) => void
  onSendMessage: () => void
  loading: boolean
  endpointMissing?: boolean
}

export default function ChatArea({
  chat,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  loading,
  endpointMissing = false,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Scroll to bottom function
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Handle scroll events to detect if user is at bottom
  const handleScroll = () => {
    if (!messagesContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const isBottom = scrollHeight - scrollTop - clientHeight < 10
    setIsAtBottom(isBottom)
  }

  // Scroll to bottom on initial load and when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Use 'auto' for initial load to prevent animation
      scrollToBottom(isAtBottom ? "smooth" : "auto")
    }
  }, [messages, isAtBottom])

  // Add scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSendMessage()
    }
  }

  // Format date for message grouping
  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date)
    return messageDate.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: messageDate.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    })
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups: Record<string, Message[]>, message) => {
    const date = formatMessageDate(message.date)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(message)
    return groups
  }, {})

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0e1621] text-[#8e9ba8]">
        <div className="text-center">
          <h3 className="text-xl mb-2">Select a chat to start messaging</h3>
          <p>Choose from your existing conversations or start a new one</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0e1621]">
      {/* Chat header */}
      <div className="p-3 flex items-center justify-between bg-[#17212b] border-b border-[#0e1621] z-10">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-[#242f3d] flex items-center justify-center text-white">
            {chat.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="ml-3">
            <h3 className="font-medium text-white">{chat.name}</h3>
            <p className="text-xs text-[#8e9ba8]">
              {chat.unread_count > 0 ? `${chat.unread_count} unread messages` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-[#6c7883]">
          <button className="p-1 hover:text-white">
            <Phone size={20} />
          </button>
          <button className="p-1 hover:text-white">
            <Video size={20} />
          </button>
          <button className="p-1 hover:text-white">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Endpoint missing warning */}
      {endpointMissing && (
        <div className="bg-yellow-500 bg-opacity-10 p-3 text-yellow-300 flex items-center">
          <AlertTriangle size={20} className="mr-2" />
          <div>
            <p className="font-medium">Missing API Endpoint</p>
            <p className="text-sm">
              The get_messages endpoint is not implemented on your backend. Add it to see real messages.
            </p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-[#0e1621]" onScroll={handleScroll}>
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 size={24} className="text-[#5288c1] animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#8e9ba8]">
            <p>No messages yet</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full flex flex-col justify-end min-h-full">
            {/* Grouped messages by date */}
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date} className="mb-4">
                {/* Date separator */}
                <div className="flex justify-center mb-4">
                  <div className="bg-[#182533] text-[#8e9ba8] text-xs px-3 py-1 rounded-full">{date}</div>
                </div>

                {/* Messages for this date */}
                {dateMessages.map((message, index) => {
                  // Check if this message is part of a group
                  const prevMessage = index > 0 ? dateMessages[index - 1] : null
                  const nextMessage = index < dateMessages.length - 1 ? dateMessages[index + 1] : null

                  const isFirstInGroup =
                    !prevMessage ||
                    prevMessage.out !== message.out ||
                    new Date(message.date).getTime() - new Date(prevMessage.date).getTime() > 300000

                  const isLastInGroup =
                    !nextMessage ||
                    nextMessage.out !== message.out ||
                    new Date(nextMessage.date).getTime() - new Date(message.date).getTime() > 300000

                  // Determine bubble style based on position in group
                  let bubbleStyle = ""
                  if (message.out) {
                    bubbleStyle = "bg-[#2b5278] text-white"
                    if (isFirstInGroup) bubbleStyle += " rounded-tr-none"
                  } else {
                    bubbleStyle = "bg-[#182533] text-white"
                    if (isFirstInGroup) bubbleStyle += " rounded-tl-none"
                  }

                  return (
                    <div key={message.id} className={`flex mb-1 ${message.out ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg px-4 py-2 ${bubbleStyle}`}>
                        <p>{message.text}</p>
                        <div className={`text-xs mt-1 flex items-center ${message.out ? "justify-end" : ""}`}>
                          <span className="text-[#8e9ba8]">{message.time}</span>
                          {message.out && (
                            <span className="ml-1 text-[#8e9ba8]">{message.status === "read" ? "✓✓" : "✓"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="p-3 bg-[#17212b] border-t border-[#0e1621]">
        <div className="flex items-center bg-[#242f3d] rounded-lg p-1">
          <button className="p-2 text-[#6c7883] hover:text-white">
            <Paperclip size={20} />
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            className="flex-1 bg-transparent border-none text-white resize-none py-2 px-3 focus:outline-none max-h-32"
            rows={1}
          />
          {newMessage.trim() ? (
            <button className="p-2 text-[#6c7883] hover:text-white" onClick={onSendMessage}>
              <Send size={20} />
            </button>
          ) : (
            <>
              <button className="p-2 text-[#6c7883] hover:text-white">
                <Smile size={20} />
              </button>
              <button className="p-2 text-[#6c7883] hover:text-white">
                <Mic size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

