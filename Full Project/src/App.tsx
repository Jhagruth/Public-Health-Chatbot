import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import { chatAPI } from './services/api'
import './App.css'

export interface Chat {
  id: string
  title: string
  lastMessage: string
  timestamp: Date
}

const App: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [chats, setChats] = useState<Chat[]>([])
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ [key: string]: Array<{ id: string; text: string; sender: 'user' | 'bot'; timestamp: Date; isLoading?: boolean }> }>({})
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null)

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      lastMessage: '',
      timestamp: new Date(),
    }
    setChats(prevChats => [newChat, ...prevChats])
    setActiveChatId(newChat.id)
    setMessages(prevMessages => ({ ...prevMessages, [newChat.id]: [] }))
  }

  const handleSendMessage = async (text: string, lang: string = 'auto') => {
    let chatId = activeChatId
    
    // Create new chat if none exists
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: 'New Chat',
        lastMessage: '',
        timestamp: new Date(),
      }
      chatId = newChat.id
      setChats(prevChats => [newChat, ...prevChats])
      setActiveChatId(chatId)
      // Initialize messages with the user message directly
      const userMessage = {
        id: Date.now().toString(),
        text,
        sender: 'user' as const,
        timestamp: new Date(),
      }
      setMessages(prevMessages => ({ ...prevMessages, [chatId]: [userMessage] }))
    } else {
      const userMessage = {
        id: Date.now().toString(),
        text,
        sender: 'user' as const,
        timestamp: new Date(),
      }
      
      // Add user message immediately using functional update
      setMessages(prevMessages => {
        const currentMessages = prevMessages[chatId] || []
        return {
          ...prevMessages,
          [chatId]: [...currentMessages, userMessage],
        }
      })
    }

    // Update chat title if it's still "New Chat" using functional update
    setChats(prevChats => prevChats.map(chat => 
      chat.id === chatId && chat.title === 'New Chat'
        ? { ...chat, title: text.slice(0, 30) + (text.length > 30 ? '...' : ''), lastMessage: text, timestamp: new Date() }
        : chat.id === chatId
        ? { ...chat, lastMessage: text, timestamp: new Date() }
        : chat
    ))

      // Add loading message
      const loadingMessageId = (Date.now() + 1).toString()
      if (chatId) {
        setMessages(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), {
            id: loadingMessageId,
            text: '',
            sender: 'bot' as const,
            timestamp: new Date(),
            isLoading: true,
          }],
        }))
        setLoadingChatId(chatId)
      }

    try {
      // Call backend API with language
      const response = await chatAPI.sendMessage(text, lang)
      
      // Replace loading message with actual response
      if (chatId) {
        setMessages(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map(msg =>
            msg.id === loadingMessageId
              ? {
                  id: loadingMessageId,
                  text: response.reply,
                  sender: 'bot' as const,
                  timestamp: new Date(),
                  lang: response.lang,
                }
              : msg
          ),
        }))
      }

      // Update chat last message
      setChats(prevChats => prevChats.map(chat =>
        chat.id === chatId
          ? { ...chat, lastMessage: response.reply, timestamp: new Date() }
          : chat
      ))
    } catch (error) {
      // Replace loading message with error message
      if (chatId) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get response from server'
        setMessages(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map(msg =>
            msg.id === loadingMessageId
              ? {
                  id: loadingMessageId,
                  text: `Sorry, I encountered an error: ${errorMessage}. Please make sure the backend server is running.`,
                  sender: 'bot' as const,
                  timestamp: new Date(),
                }
              : msg
          ),
        }))
      }
    } finally {
      setLoadingChatId(null)
    }
  }

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onChatSelect={setActiveChatId}
        onNewChat={handleNewChat}
        isVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
      />
      <ChatArea
        activeChatId={activeChatId}
        messages={activeChatId ? (messages[activeChatId] || []) : []}
        onSendMessage={handleSendMessage}
        isLoading={loadingChatId === activeChatId}
      />
    </div>
  )
}

export default App
