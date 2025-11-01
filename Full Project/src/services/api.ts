// API service for backend communication
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'

export interface ChatResponse {
  reply: string
  lang: string
}

export interface ChatRequest {
  query: string
  lang?: string
}

export const chatAPI = {
  /**
   * Send a message to the backend and get a response
   */
  async sendMessage(query: string, lang: string = 'auto'): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          lang,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ChatResponse = await response.json()
      return data
    } catch (error) {
      console.error('Error sending message to backend:', error)
      throw new Error(
        error instanceof Error 
          ? `Failed to get response: ${error.message}` 
          : 'Failed to get response from server. Please check if the backend is running.'
      )
    }
  },
}


