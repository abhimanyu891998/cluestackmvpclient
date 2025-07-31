'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboardState } from './useDashboardState'
import { buildSSEUrl } from '@/config/api'

interface SSEMessage {
  type: string
  data: Record<string, unknown>
  timestamp: string
}

// Global singleton SSE connection
class SSESingleton {
  private static instance: SSESingleton | null = null
  private eventSource: EventSource | null = null
  private isConnecting = false
  private reconnectTimeout: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private baseDelay = 2000
  
  // Subscribers for connection state and messages
  private connectionSubscribers = new Set<(connected: boolean) => void>()
  private messageSubscribers = new Set<(message: SSEMessage) => void>()
  private errorSubscribers = new Set<(error: string) => void>()

  static getInstance(): SSESingleton {
    if (!SSESingleton.instance) {
      SSESingleton.instance = new SSESingleton()
    }
    return SSESingleton.instance
  }

  subscribe(
    onConnectionChange: (connected: boolean) => void,
    onMessage: (message: SSEMessage) => void,
    onError: (error: string) => void
  ) {
    this.connectionSubscribers.add(onConnectionChange)
    this.messageSubscribers.add(onMessage)
    this.errorSubscribers.add(onError)

    // If already connected, notify immediately
    if (this.eventSource?.readyState === EventSource.OPEN) {
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

  private notifyMessage(message: SSEMessage) {
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
      console.log('🔄 SSE connection already in progress, skipping')
      return
    }

    // Don't reconnect if already connected
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.log('✅ SSE already connected, skipping')
      return
    }

    // Check reconnection attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max SSE reconnection attempts reached')
      this.notifyError('Max reconnection attempts reached')
      return
    }

    this.isConnecting = true
    console.log(`🔌 Creating SSE connection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

    // Clean up existing connection
    this.cleanup()

    try {
      this.eventSource = new EventSource(buildSSEUrl())

      this.eventSource.onopen = () => {
        console.log('✅ SSE connected successfully')
        this.isConnecting = false
        this.reconnectAttempts = 0 // Reset on successful connection
        this.notifyConnectionChange(true)
      }

      this.eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data)
          this.notifyMessage(message)
        } catch (error) {
          console.error('❌ Error parsing SSE message:', error)
        }
      }

      this.eventSource.onerror = (event) => {
        console.error('❌ SSE error:', event)
        this.isConnecting = false
        this.notifyConnectionChange(false)

        // Close and attempt reconnect
        this.eventSource?.close()
        this.eventSource = null

        // Auto-reconnect on errors
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts)
          this.reconnectAttempts++
          
          console.log(`🔄 Scheduling SSE reconnect in ${delay}ms`)
          
          this.reconnectTimeout = setTimeout(() => {
            this.connect()
          }, delay)
        } else {
          this.notifyError('SSE connection failed - max attempts reached')
        }
      }

    } catch (error) {
      console.error('❌ Error creating SSE connection:', error)
      this.isConnecting = false
      this.notifyError('Failed to create SSE connection')
    }
  }

  private cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.eventSource) {
      this.eventSource.onopen = null
      this.eventSource.onmessage = null
      this.eventSource.onerror = null
      this.eventSource.close()
      this.eventSource = null
    }
  }

  disconnect() {
    this.cleanup()
    this.reconnectAttempts = 0
    this.notifyConnectionChange(false)
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN || false
  }
}

export function useSSE(dashboardState: ReturnType<typeof useDashboardState>) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sseInstance = useRef<SSESingleton>(SSESingleton.getInstance())

  const handleMessage = useCallback((message: SSEMessage) => {
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
          uptime_seconds: (message.data.uptime_seconds as number) || 0,
          total_events_received: (message.data.total_messages_received as number) || 0
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

      case 'keepalive':
        // Handle keepalive messages silently
        console.log('🔄 Keepalive received')
        break

      default:
        console.log('❓ Unknown message type:', message.type)
    }
  }, [dashboardState])

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected)
    if (connected) {
      setError(null)
      dashboardState.addLog('INFO', 'SSE connected successfully')
    } else {
      dashboardState.addLog('WARNING', 'SSE connection lost')
    }
  }, [dashboardState])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    dashboardState.addLog('ERROR', errorMessage)
  }, [dashboardState])

  // Create stable callback references using refs to avoid re-subscriptions
  const connectionChangeRef = useRef(handleConnectionChange)
  const messageRef = useRef(handleMessage)  
  const errorRef = useRef(handleError)

  useEffect(() => {
    console.log('🎯 Subscribing to SSE singleton')
    
    // Update refs when callbacks change
    connectionChangeRef.current = handleConnectionChange
    messageRef.current = handleMessage
    errorRef.current = handleError
  }, [handleConnectionChange, handleError, handleMessage])

  useEffect(() => {
    // Subscribe to the singleton SSE with stable wrapper functions
    const unsubscribe = sseInstance.current.subscribe(
      (connected) => connectionChangeRef.current(connected),
      (message) => messageRef.current(message),
      (error) => errorRef.current(error)
    )

    // Connect if not already connected
    if (!sseInstance.current.isConnected()) {
      sseInstance.current.connect()
    }

    return () => {
      console.log('🔥 Unsubscribing from SSE singleton')
      unsubscribe()
    }
  }, [])

  return { isConnected, error }
}

// Export the SSE singleton class for direct access
export { SSESingleton }