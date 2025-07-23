'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboardState } from './useDashboardState'

interface WebSocketMessage {
  type: string
  data: Record<string, unknown>
  timestamp: string
}

export function useWebSocket(dashboardState: ReturnType<typeof useDashboardState>) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 10
  const baseDelay = 1000 // 1 second base delay

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      // Remove event listeners to prevent them from firing during cleanup
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component cleanup')
      }
      wsRef.current = null
    }
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      console.log('📨 Received:', message.type)

      switch (message.type) {
        case 'connection':
          console.log('🤝 Server connection established')
          dashboardState.addLog('INFO', `Connected to server: ${message.data.message}`)
          break

        case 'heartbeat':
          console.log('💓 Heartbeat received')
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
          
          if (isStale && dataAge > 300) {
            console.warn('CRITICAL: Data staleness detected', {
              dataAge: dataAge,
              sequenceId: message.data.sequence_id as number,
              processingDelay: message.data.processing_delay_ms as number
            })
            dashboardState.addLog('CRITICAL', `Stale data detected: ${dataAge}ms old (seq: ${message.data.sequence_id as number})`)
          } else if (isStale) {
            console.warn('WARNING: Data freshness degraded', {
              dataAge: dataAge,
              sequenceId: message.data.sequence_id as number
            })
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
            console.error('CRITICAL: Stale data incident detected', message.data)
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
    } catch (err) {
      console.error('❌ Error parsing WebSocket message:', err)
      dashboardState.addLog('ERROR', `Failed to parse WebSocket message: ${err}`)
    }
  }, [dashboardState])

  const connect = useCallback(() => {
    // Don't attempt connection if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('🔄 Connection already exists, skipping')
      return
    }

    // Check reconnect attempts
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached')
      setError('Max reconnection attempts reached')
      return
    }

    console.log(`🔌 Attempting WebSocket connection (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`)
    cleanup() // Ensure clean state
    
    try {
      const ws = new WebSocket('ws://127.0.0.1:8000/ws')
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully')
        setIsConnected(true)
        setError(null)
        reconnectAttempts.current = 0 // Reset on successful connection
        dashboardState.addLog('INFO', 'WebSocket connected successfully')
      }

      ws.onmessage = handleMessage

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`)
        setIsConnected(false)
        wsRef.current = null
        
        dashboardState.addLog('WARNING', `WebSocket connection lost (${event.code})`)

        // Only auto-reconnect on unexpected closures
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseDelay * Math.pow(2, reconnectAttempts.current)
          reconnectAttempts.current++
          
          console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else if (event.code === 1000 || event.code === 1001) {
          console.log('✅ WebSocket closed normally')
          reconnectAttempts.current = 0
        } else {
          console.error('❌ Max reconnect attempts reached, giving up')
          setError('Connection failed - max attempts reached')
        }
      }

      ws.onerror = (event) => {
        console.error('❌ WebSocket error:', event)
        setError('Connection error')
        dashboardState.addLog('ERROR', 'WebSocket connection error')
      }

    } catch (err) {
      console.error('❌ Error creating WebSocket:', err)
      setError('Failed to create connection')
      dashboardState.addLog('ERROR', `Failed to create WebSocket: ${err}`)
    }
  }, [handleMessage, dashboardState, cleanup])

  // Initial connection and cleanup
  useEffect(() => {
    connect()
    return cleanup
  }, [connect, cleanup])

  return { isConnected, error }
}