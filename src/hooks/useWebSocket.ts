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
  const isConnectingRef = useRef(false)

  const connect = useCallback(() => {
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    isConnectingRef.current = true
    console.log('🔌 Attempting WebSocket connection...')

    try {
      // Add some debug info about the connection
      console.log('🔍 Connecting from origin:', window.location.origin)
      console.log('🔍 Connecting to:', 'ws://127.0.0.1:8000/ws')
      
      const ws = new WebSocket('ws://127.0.0.1:8000/ws')
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully')
        setIsConnected(true)
        setError(null)
        isConnectingRef.current = false
        dashboardState.addLog('INFO', 'WebSocket connected successfully')
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          console.log('📨 Received:', message.type, message.data)

          switch (message.type) {
            case 'connection':
              console.log('🤝 Server connection established')
              dashboardState.addLog('INFO', `Connected to server: ${message.data.message}`)
              break

            case 'heartbeat':
              console.log('💓 Heartbeat received:', message.data)
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
              console.log('📊 Orderbook update received:', message.data)
              
              // Check for stale data
              const dataAge = (message.data.data_age_ms as number) || 0
              const isStale = (message.data.is_stale as boolean) || false
              
              // Log staleness warnings
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
              console.log('🚨 Incident alert received:', message.data)
              
              let incidentDetails = ''
              let logMessage = ''
              
              // Special handling for stale data alerts
              if (message.data.type === 'stale_data') {
                console.error('CRITICAL: Stale data incident detected', message.data)
                incidentDetails = `Data age: ${message.data.data_age_ms as number}ms, Processing delay: ${message.data.processing_delay_ms as number}ms, Queue: ${message.data.queue_size as number}`
                logMessage = `STALE DATA ALERT: ${message.data.data_age_ms as number}ms lag on sequence ${message.data.sequence_id as number}`
                dashboardState.addLog('CRITICAL', logMessage)
              } else {
                // Handle other incident types (memory threshold, etc.)
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
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        isConnectingRef.current = false
        dashboardState.addLog('WARNING', `WebSocket connection lost (${event.code})`)

        // Only reconnect for certain error codes, and add exponential backoff
        if (event.code !== 1000 && event.code !== 1001) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
          }
          
          // Add exponential backoff to prevent rapid reconnections
          const backoffDelay = Math.min(3000 * Math.pow(2, 0), 30000) // Start with 3s, max 30s
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Attempting to reconnect after ${backoffDelay}ms delay...`)
            dashboardState.addLog('INFO', 'Attempting to reconnect...')
            connect()
          }, backoffDelay)
        } else {
          console.log('✅ WebSocket closed normally, not reconnecting')
        }
      }

      ws.onerror = (event) => {
        console.error('❌ WebSocket error:', event)
        setError('Connection error')
        setIsConnected(false)
        isConnectingRef.current = false
        dashboardState.addLog('ERROR', 'WebSocket connection error')
      }

    } catch (err) {
      console.error('❌ Error creating WebSocket connection:', err)
      setError('Failed to connect')
      setIsConnected(false)
      isConnectingRef.current = false
      dashboardState.addLog('ERROR', `Failed to create WebSocket connection: ${err}`)
    }
  }, [dashboardState])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
      }
    }
  }, [connect])

  return { isConnected, error }
} 