"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ChatInterfaceProps {
  taskId: string
  userId: string
  userName: string
  initialMessages: any[]
  participants: any[]
}

export function ChatInterface({ taskId, userId, userName, initialMessages, participants }: ChatInterfaceProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Send a new message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          content: newMessage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to send message")
      }

      // Add the new message to the list
      setMessages([...messages, data])
      setNewMessage("")
    } catch (error) {
      toast({
        title: "发送失败",
        description: "消息发送失败，请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Get user initials for avatar
  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  // Check if message is from current user
  const isCurrentUser = (senderId: string) => {
    return senderId === userId
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-medium">聊天参与者</h3>
          <div className="flex items-center gap-2 mt-1">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-1">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">{getUserInitials(participant.name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs">{participant.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">暂无消息，发送第一条消息开始聊天</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${isCurrentUser(message.senderId) ? "justify-end" : "justify-start"}`}
            >
              {!isCurrentUser(message.senderId) && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getUserInitials(message.sender.name)}</AvatarFallback>
                </Avatar>
              )}
              <div className="max-w-[70%]">
                {!isCurrentUser(message.senderId) && (
                  <p className="text-xs text-muted-foreground mb-1">{message.sender.name}</p>
                )}
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isCurrentUser(message.senderId) ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {message.content}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(message.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </div>
              {isCurrentUser(message.senderId) && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getUserInitials(userName)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="输入消息..."
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
