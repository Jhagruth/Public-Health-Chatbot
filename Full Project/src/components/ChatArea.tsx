import React, { useState, useRef, useEffect } from 'react'
import './ChatArea.css'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  lang?: string
}

interface ChatAreaProps {
  activeChatId: string | null
  messages: Message[]
  onSendMessage: (text: string, lang?: string) => void
}

// Speech Recognition Types
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onend: () => void
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
  item(index: number): SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const ChatArea: React.FC<ChatAreaProps> = ({ activeChatId, messages, onSendMessage }) => {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<'en-US' | 'hi-IN' | 'te-IN'>('en-US')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalTranscriptRef = useRef<string>('')
  const synthRef = useRef<SpeechSynthesis | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize Text-to-Speech
  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setIsSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = selectedLanguage

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ''
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }
        
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript
        }
        
        const displayText = finalTranscriptRef.current + interimTranscript
        setInput(displayText.trim())
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        const transcriptToSend = finalTranscriptRef.current.trim()
        finalTranscriptRef.current = ''
        
        // Auto-send if we have any transcribed text
        if (transcriptToSend) {
          const langMap: Record<string, string> = {
            'en-US': 'en',
            'hi-IN': 'hi',
            'te-IN': 'te'
          }
          const backendLang = langMap[selectedLanguage] || 'en'
          
          setTimeout(() => {
            onSendMessage(transcriptToSend, backendLang)
            setInput('')
          }, 100)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        // Auto-send the transcribed text when recognition ends
        const transcriptToSend = finalTranscriptRef.current.trim()
        if (transcriptToSend) {
          // Map recognition language to backend language code
          const langMap: Record<string, string> = {
            'en-US': 'en',
            'hi-IN': 'hi',
            'te-IN': 'te'
          }
          const backendLang = langMap[selectedLanguage] || 'en'
          
          setTimeout(() => {
            onSendMessage(transcriptToSend, backendLang)
            setInput('')
            finalTranscriptRef.current = ''
          }, 100)
        } else {
          finalTranscriptRef.current = ''
        }
      }

      recognitionRef.current = recognition
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [selectedLanguage, onSendMessage])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      const langMap: Record<string, string> = {
        'en-US': 'en',
        'hi-IN': 'hi',
        'te-IN': 'te'
      }
      const backendLang = langMap[selectedLanguage] || 'auto'
      onSendMessage(input.trim(), backendLang)
      setInput('')
    }
  }

  // Function to speak text
  const speakText = (text: string, lang: string) => {
    if (synthRef.current) {
      synthRef.current.cancel()
      
      const langCodeMap: Record<string, string> = {
        'en': 'en-US',
        'hi': 'hi-IN',
        'te': 'te-IN',
        'kn': 'te-IN' // Fallback for Kannada to Telugu
      }
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = langCodeMap[lang] || 'en-US'
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 1
      
      synthRef.current.speak(utterance)
    }
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        finalTranscriptRef.current = ''
        setInput('')
        recognitionRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error('Error starting speech recognition:', error)
      }
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  if (!activeChatId) {
    return (
      <div className="chat-area">
        <div className="welcome-screen">
          <div className="welcome-content">
            <h1>Welcome to SwasthAI</h1>
            <p>Start a new conversation by clicking "New Chat" in the sidebar or type a message below.</p>
            <div className="welcome-features">
              <div className="feature">
                <span className="feature-icon">💬</span>
                <span>Intelligent Conversations</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🧠</span>
                <span>AI-Powered Assistance</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🚀</span>
                <span>Fast & Reliable</span>
              </div>
            </div>
          </div>
          <div className="input-container">
            <form onSubmit={handleSubmit} className="message-form">
              {isSpeechSupported && (
                <>
                  <select
                    className="language-select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as 'en-US' | 'hi-IN' | 'te-IN')}
                    disabled={isListening}
                  >
                    <option value="en-US">English</option>
                    <option value="hi-IN">हिंदी (Hindi)</option>
                    <option value="te-IN">తెలుగు (Telugu)</option>
                  </select>
                  <button
                    type="button"
                    className={`mic-button ${isListening ? 'listening' : ''}`}
                    onClick={handleMicClick}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                    title={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isListening ? (
                      <>
                        <rect x="9" y="2" width="6" height="11" rx="3"></rect>
                        <path d="M5 10v1a7 7 0 0 0 14 0v-1"></path>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="8" y1="22" x2="16" y2="22"></line>
                      </>
                    ) : (
                      <>
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                      </>
                    )}
                  </svg>
                </button>
                </>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening... Speak now" : "Type your message here..."}
                className="message-input"
                disabled={isListening}
              />
              <button type="submit" className="send-button" disabled={!input.trim() || isListening}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <h2>Chat</h2>
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
              >
                <div className="message-content">
                  <p>{message.text}</p>
                  <div className="message-footer">
                    <span className="message-time">{formatTimestamp(message.timestamp)}</span>
                    {message.sender === 'bot' && message.text && synthRef.current && (
                      <button
                        type="button"
                        className="speak-button"
                        onClick={() => speakText(message.text, message.lang || 'en')}
                        aria-label="Read aloud"
                        title="Read aloud"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="input-container">
        <form onSubmit={handleSubmit} className="message-form">
          {isSpeechSupported && (
            <>
              <select
                className="language-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as 'en-US' | 'hi-IN' | 'te-IN')}
                disabled={isListening}
              >
                <option value="en-US">English</option>
                <option value="hi-IN">हिंदी (Hindi)</option>
                <option value="te-IN">తెలుగు (Telugu)</option>
              </select>
              <button
                type="button"
                className={`mic-button ${isListening ? 'listening' : ''}`}
                onClick={handleMicClick}
                aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                title={isListening ? 'Stop recording' : 'Start voice input'}
              >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isListening ? (
                  <>
                    <rect x="9" y="2" width="6" height="11" rx="3"></rect>
                    <path d="M5 10v1a7 7 0 0 0 14 0v-1"></path>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="8" y1="22" x2="16" y2="22"></line>
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </>
                )}
              </svg>
            </button>
            </>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening... Speak now" : "Type your message here..."}
            className="message-input"
            disabled={isListening}
          />
          <button type="submit" className="send-button" disabled={!input.trim() || isListening}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatArea
