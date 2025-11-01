import React from 'react'
import { Chat } from '../App'
import './Sidebar.css'

interface SidebarProps {
  chats: Chat[]
  activeChatId: string | null
  onChatSelect: (id: string) => void
  onNewChat: () => void
  isVisible: boolean
  onToggleSidebar: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ chats, activeChatId, onChatSelect, onNewChat, isVisible, onToggleSidebar }) => {
  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`sidebar ${isVisible ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-title-container">
          <h1 className="sidebar-title">SwasthAI</h1>
        </div>
        <button className="sidebar-toggle-button" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isVisible ? (
              <>
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 5 12 12 19"></polyline>
              </>
            ) : (
              <>
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 19 12 12 5"></polyline>
              </>
            )}
          </svg>
        </button>
        <button className="new-chat-button" onClick={onNewChat}>
          <span className="plus-icon">+</span>
          New Chat
        </button>
      </div>
      
      <div className="sidebar-content">
        <div className="chat-list">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
              onClick={() => onChatSelect(chat.id)}
            >
              <div className="chat-item-content">
                <h3 className="chat-title">{chat.title}</h3>
                {chat.lastMessage && (
                  <p className="chat-preview">{chat.lastMessage}</p>
                )}
                <span className="chat-time">{formatTime(chat.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
