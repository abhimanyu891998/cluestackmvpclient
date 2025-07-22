'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboardState } from './useDashboardState'

interface WebSocketMessage {
  type: string
  data: Record<string, unknown>
  timestamp: string
}

// Global singleton WebSocket connection
class WebSocketSingleton {
  private static instance: WebSocketSingleton | null = null
  private ws: WebSocket | null = null
  private isConnecting = false
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private baseDelay = 2000
  
  // Subscribers for connection state and messages
  private connectionSubscribers = new Set<(connected: boolean) => void>()
  private messageSubscribers = new Set<(message: WebSocketMessage) => void>()
  private errorSubscribers = new Set<(error: string) => void>()

  static getInstance(): WebSocketSingleton {
    if (!WebSocketSingleton.instance) {
      WebSocketSingleton.instance = new WebSocketSingleton()
    }
    return WebSocketSingleton.instance
  }

  subscribe(
    onConnectionChange: (connected: boolean) => void,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: string) => void
  ) {
    this.connectionSubscribers.add(onConnectionChange)
    this.messageSubscribers.add(onMessage)
    this.errorSubscribers.add(onError)

    // If already connected, notify immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      onConnectionChange(true)
    }

    // Return unsubscribe function
    return () => {
      this.connectionSubscribers.delete(onConnectionChange)
      this.messageSubscribers.delete(onMessage)
      this.errorSubscribers.delete(onError)
    }
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionSubscribers.forEach(callback => {
      try {
        callback(connected)
      } catch (error) {
        console.error('Error in connection subscriber:', error)
      }
    })
  }

  private notifyMessage(message: WebSocketMessage) {
    this.messageSubscribers.forEach(callback => {
      try {
        callback(message)
      } catch (error) {
        console.error('Error in message subscriber:', error)
      }
    })
  }

  private notifyError(error: string) {
    this.errorSubscribers.forEach(callback => {
      try {
        callback(error)
      } catch (error) {
        console.error('Error in error subscriber:', error)
      }
    })
  }

  connect() {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.log('🔄 Connection already in progress, skipping')
      return
    }

    // Don't reconnect if already connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('✅ Already connected, skipping')
      return
    }

    // Check reconnection attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      this.notifyError('Max reconnection attempts reached')
      return
    }

    this.isConnecting = true
    console.log(`🔌 Creating WebSocket connection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

    // Clean up existing connection
    this.cleanup()

    try {
      this.ws = new WebSocket('ws://127.0.0.1:8000/ws')

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully')
        this.isConnecting = false
        this.reconnectAttempts = 0 // Reset on successful connection
        this.notifyConnectionChange(true)
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.notifyMessage(message)
        } catch (error) {
          console.error('❌ Error parsing message:', error)
        }
      }

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`)
        this.isConnecting = false
        this.ws = null
        this.notifyConnectionChange(false)

        // Auto-reconnect on unexpected closures
        if (event.code !== 1000 && event.code !== 1001 && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts)
          this.reconnectAttempts++
          
          console.log(`🔄 Scheduling reconnect in ${delay}ms`)
          
          this.reconnectTimeout = setTimeout(() => {
            this.connect()
          }, delay)
        } else if (event.code === 1000 || event.code === 1001) {
          console.log('✅ WebSocket closed normally')
          this.reconnectAttempts = 0
        } else {
          this.notifyError('Connection failed - max attempts reached')
        }
      }

      this.ws.onerror = (event) => {
        console.error('❌ WebSocket error:', event)
        this.isConnecting = false
        this.notifyError('WebSocket connection error')
      }

    } catch (error) {
      console.error('❌ Error creating WebSocket:', error)
      this.isConnecting = false
      this.notifyError('Failed to create WebSocket connection')
    }
  }

  private cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Cleanup')
      }
      this.ws = null
    }
  }

  disconnect() {
    this.cleanup()
    this.reconnectAttempts = 0
    this.notifyConnectionChange(false)
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN || false
  }
}

export function useWebSocket(dashboardState: ReturnType<typeof useDashboardState>) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsInstance = useRef<WebSocketSingleton>(WebSocketSingleton.getInstance())

  const handleMessage = useCallback((message: WebSocketMessage) => {
    console.log('📨 Received:', message.type)

    switch (message.type) {
      case 'connection':
        console.log('🤝 Server connection established')
        dashboardState.addLog('INFO', `Connected to server: ${message.data.message}`)
        break

      case 'heartbeat':
        dashboardState.updateMetrics({
          memory_usage_mb: (message.data.memory_usage_mb as number) || 0,
          queue_size: (message.data.queue_size as number) || 0,
          processing_delay_ms: (message.data.processing_delay_ms as number) || 0,
          server_status: (message.data.server_status as string) || 'unknown',
          active_clients: (message.data.active_clients as number) || 0,
          current_scenario: (message.data.current_scenario as string) || 'unknown',
          uptime_seconds: (message.data.uptime_seconds as number) || 0
        })

        dashboardState.updatePerformanceHistory(
          (message.data.memory_usage_mb as number) || 0,
          (message.data.queue_size as number) || 0,
          (message.data.processing_delay_ms as number) || 0
        )
        break

      case 'orderbook_update':
        console.log('📊 Orderbook update received')
        
        const dataAge = (message.data.data_age_ms as number) || 0
        const isStale = (message.data.is_stale as boolean) || false
        
        if (isStale && dataAge > 1000) {
          dashboardState.addLog('CRITICAL', `Stale data detected: ${dataAge}ms old (seq: ${message.data.sequence_id as number})`)
        } else if (isStale) {
          dashboardState.addLog('WARNING', `Data freshness degraded: ${dataAge}ms lag`)
        }
        
        dashboardState.updateOrderbook({
          bids: (message.data.bids as [string, string][]) || [],
          asks: (message.data.asks as [string, string][]) || [],
          mid_price: (message.data.mid_price as number) || 0,
          spread: (message.data.spread as number) || 0,
          sequence_id: (message.data.sequence_id as number) || 0,
          timestamp: (message.data.timestamp as string) || new Date().toISOString(),
          data_age_ms: dataAge,
          is_stale: isStale,
          processing_delay_ms: (message.data.processing_delay_ms as number) || 0
        })
        break

      case 'incident_alert':
        console.log('🚨 Incident alert received')
        
        let incidentDetails = ''
        let logMessage = ''
        
        if (message.data.type === 'stale_data') {
          incidentDetails = `Data age: ${message.data.data_age_ms as number}ms, Processing delay: ${message.data.processing_delay_ms as number}ms, Queue: ${message.data.queue_size as number}`
          logMessage = `STALE DATA ALERT: ${message.data.data_age_ms as number}ms lag on sequence ${message.data.sequence_id as number}`
          dashboardState.addLog('CRITICAL', logMessage)
        } else {
          incidentDetails = typeof message.data.details === 'object' 
            ? JSON.stringify(message.data.details) 
            : (message.data.details as string) || 'No details provided'
          logMessage = `Incident: ${message.data.type as string} - ${incidentDetails}`
          dashboardState.addLog('INCIDENT', logMessage)
        }
        
        dashboardState.addIncident({
          timestamp: (message.data.timestamp as string) || new Date().toISOString(),
          type: (message.data.type as string) || 'Unknown',
          details: incidentDetails,
          scenario: (message.data.scenario as string) || 'unknown',
          uptime: (message.data.uptime as number) || (message.data.uptime_seconds as number) || 0
        })
        break

      default:
        console.log('❓ Unknown message type:', message.type)
    }
  }, [dashboardState.addLog, dashboardState.updateMetrics, dashboardState.updatePerformanceHistory, dashboardState.updateOrderbook, dashboardState.addIncident])

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected)
    if (connected) {
      setError(null)
      dashboardState.addLog('INFO', 'WebSocket connected successfully')
    } else {
      dashboardState.addLog('WARNING', 'WebSocket connection lost')
    }
  }, [dashboardState.addLog])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    dashboardState.addLog('ERROR', errorMessage)
  }, [dashboardState.addLog])

  // Create stable callback references using refs to avoid re-subscriptions
  const connectionChangeRef = useRef(handleConnectionChange)
  const messageRef = useRef(handleMessage)  
  const errorRef = useRef(handleError)

  useEffect(() => {
    console.log('🎯 Subscribing to WebSocket singleton')
    
    // Update refs when callbacks change
    connectionChangeRef.current = handleConnectionChange
    messageRef.current = handleMessage
    errorRef.current = handleError
    
    // Subscribe to the singleton WebSocket with stable wrapper functions
    const unsubscribe = wsInstance.current.subscribe(
      (connected) => connectionChangeRef.current(connected),
      (message) => messageRef.current(message),
      (error) => errorRef.current(error)
    )

    // Connect if not already connected
    if (!wsInstance.current.isConnected()) {
      wsInstance.current.connect()
    }

    return () => {
      console.log('🔥 Unsubscribing from WebSocket singleton')
      unsubscribe()
    }
  }, []) // Empty deps array since we use refs for callbacks

  return { isConnected, error }
}